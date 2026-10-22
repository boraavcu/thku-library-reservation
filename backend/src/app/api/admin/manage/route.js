import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import {
  runReservationLifecycleChecks,
  sendNoShowWarningEmail,
  sendKioskCheckInEmailToStaff,
} from "@/lib/lifecycle";

const ALLOWED_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"];

function getIstanbulDateInfo() {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const todayDate = new Date(`${todayStr}T00:00:00Z`);

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const currentHour = Number(timeParts.find((p) => p.type === "hour").value);
  const currentMinute = Number(timeParts.find((p) => p.type === "minute").value);

  return { todayStr, todayDate, currentHour, currentMinute };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;

  if (!session?.user?.id || !ALLOWED_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  try {
    // 30 dk davet zaman aşımı ve son 2 saat hatırlatma kontrollerini çalıştır
    await runReservationLifecycleChecks();

    const now = new Date();
    // Loglar 180 gün gösterilsin, 1 yıl (365 gün) arşivlensin
    const days180Ago = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const days365Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // 1 yıldan (365 gün) eski logları otomatik temizle (Rotasyon)
    await Promise.all([
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: days365Ago } } }),
      prisma.adminAction.deleteMany({ where: { createdAt: { lt: days365Ago } } }),
    ]);

    const [
      rooms,
      reservations,
      users,
      rules,
      announcements,
      auditLogs,
      adminActions,
      archivedAuditCount,
      archivedAdminCount,
    ] = await Promise.all([
      prisma.room.findMany({ orderBy: { roomNumber: "asc" } }),
      prisma.reservation.findMany({
        take: 150,
        orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }],
        include: {
          room: { select: { id: true, roomNumber: true, name: true, capacity: true } },
          user: { select: { id: true, fullName: true, email: true, studentNumber: true, department: true } },
          participants: {
            include: { user: { select: { id: true, fullName: true, email: true, department: true } } },
          },
        },
      }),
      prisma.user.findMany({
        orderBy: [{ isBanned: "desc" }, { penaltyPoints: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          fullName: true,
          email: true,
          studentNumber: true,
          department: true,
          role: true,
          penaltyPoints: true,
          isBanned: true,
          banUntil: true,
          banReason: true,
          _count: {
            select: {
              penalties: {
                where: { penaltyType: "NO_SHOW", isActive: true },
              },
            },
          },
        },
      }),
      prisma.reservationRule.findMany({ orderBy: { ruleName: "asc" } }),
      prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      // MADDE 11: Ekranda sadece son 180 günün logları gösterilir
      userRole === "SUPER_ADMIN"
        ? prisma.auditLog.findMany({
            where: { createdAt: { gte: days180Ago } },
            take: 120,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { fullName: true, email: true, role: true } } },
          })
        : Promise.resolve([]),
      userRole === "SUPER_ADMIN"
        ? prisma.adminAction.findMany({
            where: { createdAt: { gte: days180Ago } },
            take: 120,
            orderBy: { createdAt: "desc" },
            include: { admin: { select: { fullName: true, email: true, role: true } } },
          })
        : Promise.resolve([]),
      userRole === "SUPER_ADMIN"
        ? prisma.auditLog.count({
            where: { createdAt: { gte: days365Ago, lt: days180Ago } },
          })
        : Promise.resolve(0),
      userRole === "SUPER_ADMIN"
        ? prisma.adminAction.count({
            where: { createdAt: { gte: days365Ago, lt: days180Ago } },
          })
        : Promise.resolve(0),
    ]);

    // Analitik Hesaplamalar (Isı Haritası, Bölüm Dağılımı, Gelecek 1 Saat Radarı)
    const { todayDate, currentHour, currentMinute } = getIstanbulDateInfo();
    const nowTotalMins = currentHour * 60 + currentMinute;

    const hourlyHeatmap = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      hourNum: h,
      count: 0,
    }));

    const deptCounts = {};
    let activeNowRooms = 0;
    let upcomingHourReservations = 0;
    let upcomingHourStudents = 0;

    const validReservations = reservations.filter(
      (r) => !["CANCELLED", "NO_SHOW"].includes(r.status)
    );

    for (const r of validReservations) {
      const sH = new Date(r.startTime).getUTCHours();
      const sM = new Date(r.startTime).getUTCMinutes();
      const endDt = new Date(r.endTime);
      const eH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();

      for (let h = sH; h < eH; h++) {
        if (h >= 0 && h < 24) {
          hourlyHeatmap[h].count += 1;
        }
      }

      const orgDept = r.user?.department || "Diğer Bölümler";
      deptCounts[orgDept] = (deptCounts[orgDept] || 0) + 1;

      for (const p of r.participants || []) {
        if (p.status === "ACCEPTED") {
          const pDept = p.user?.department || "Diğer Bölümler";
          deptCounts[pDept] = (deptCounts[pDept] || 0) + 1;
        }
      }

      const rDateStr = new Date(r.reservationDate).toISOString().split("T")[0];
      const todayIsoStr = todayDate.toISOString().split("T")[0];

      if (rDateStr === todayIsoStr) {
        const startMins = sH * 60 + sM;
        const endMins = eH * 60;
        const confirmedGroupSize =
          1 + (r.participants || []).filter((p) => p.status === "ACCEPTED").length;

        if (r.status === "CHECKED_IN" || (nowTotalMins >= startMins && nowTotalMins < endMins)) {
          activeNowRooms += 1;
        }

        const diffToStart = startMins - nowTotalMins;
        if (diffToStart >= 0 && diffToStart <= 60 && ["CONFIRMED", "PENDING"].includes(r.status)) {
          upcomingHourReservations += 1;
          upcomingHourStudents += confirmedGroupSize;
        }
      }
    }

    const totalDeptUsage = Object.values(deptCounts).reduce((a, b) => a + b, 0) || 1;
    const departmentBreakdown = Object.entries(deptCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalDeptUsage) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const peakHourObj = [...hourlyHeatmap].sort((a, b) => b.count - a.count)[0] || {
      hour: "14:00",
      count: 0,
    };

    return NextResponse.json({
      rooms,
      reservations,
      users,
      rules,
      announcements,
      auditLogs,
      adminActions,
      logRetentionPolicy: {
        activeDisplayDays: 180,
        archiveRetentionDays: 365,
        archivedRecordsCount: archivedAuditCount + archivedAdminCount,
      },
      analytics: {
        hourlyHeatmap,
        departmentBreakdown,
        peakHour: peakHourObj.hour,
        activeNowRooms,
        upcomingHourReservations,
        upcomingHourStudents,
      },
    });
  } catch (error) {
    console.error("Admin GET error:", error);
    return NextResponse.json({ error: "Veriler alınamadı." }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const currentRole = session?.user?.role;
  const adminId = session?.user?.id;

  if (!adminId || !ALLOWED_ROLES.includes(currentRole)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, payload } = body;

    // 1. Odayı Aktif / Pasif (Bakımda) Yap
    if (action === "TOGGLE_ROOM") {
      const { roomId, isActive } = payload;
      const room = await prisma.room.update({
        where: { id: roomId },
        data: { isActive: Boolean(isActive) },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: isActive ? "ROOM_UPDATED" : "ROOM_DEACTIVATED",
          targetEntityType: "Room",
          targetEntityId: roomId,
          description: `${room.roomNumber} (${room.name}) odası ${isActive ? "rezervasyona açıldı" : "bakıma alındı (kapatıldı)"}.`,
        },
      });

      return NextResponse.json({ success: true, room });
    }

    // Yeni Çalışma Odası Ekle
    if (action === "CREATE_ROOM") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Yeni oda ekleme yetkisi sadece İdare/Admin rolündedir." }, { status: 403 });
      }
      const { roomNumber, name, capacity } = payload;
      const created = await prisma.room.create({
        data: {
          roomNumber: roomNumber.trim().toUpperCase(),
          name: name.trim(),
          capacity: Number(capacity) || 8,
          isActive: true,
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "ROOM_CREATED",
          targetEntityType: "Room",
          targetEntityId: created.id,
          description: `Yeni çalışma odası eklendi: ${created.roomNumber} (${created.name}) Kapasite: ${created.capacity}`,
        },
      });

      return NextResponse.json({ success: true, room: created });
    }

    //  Var Olan Odanın İsmini, Kodunu ve Kapasitesini Düzenle (UPDATE_ROOM)
    if (action === "UPDATE_ROOM") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Oda bilgilerini düzenleme yetkisi sadece İdare/Admin rolündedir." }, { status: 403 });
      }
      const { roomId, roomNumber, name, capacity } = payload;
      if (!roomId || !roomNumber?.trim() || !name?.trim()) {
        return NextResponse.json({ error: "Oda kodu ve oda adı boş bırakılamaz." }, { status: 400 });
      }

      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: {
          roomNumber: roomNumber.trim().toUpperCase(),
          name: name.trim(),
          capacity: Math.max(2, Number(capacity) || 8),
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "ROOM_UPDATED",
          targetEntityType: "Room",
          targetEntityId: roomId,
          description: `Oda bilgileri güncellendi: ${updatedRoom.roomNumber} (${updatedRoom.name}) Yeni Kapasite: ${updatedRoom.capacity} Kişi.`,
        },
      });

      return NextResponse.json({ success: true, room: updatedRoom });
    }

    // Odayı Kalıcı Olarak Sil (DELETE_ROOM)
    if (action === "DELETE_ROOM") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Oda silme yetkisi sadece İdare/Admin rolündedir." }, { status: 403 });
      }
      const { roomId } = payload;
      const targetRoom = await prisma.room.findUnique({ where: { id: roomId } });
      if (!targetRoom) {
        return NextResponse.json({ error: "Oda bulunamadı." }, { status: 404 });
      }

      // Bağlı rezervasyonlar varsa önce onları temizle ki FK hatası vermesin
      await prisma.reservation.deleteMany({ where: { roomId } });
      await prisma.room.delete({ where: { id: roomId } });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "ROOM_DEACTIVATED",
          targetEntityType: "Room",
          targetEntityId: roomId,
          description: `${targetRoom.roomNumber} (${targetRoom.name}) odası sistemden kalıcı olarak silindi.`,
        },
      });

      return NextResponse.json({ success: true });
    }

    // Rezervasyon Operasyonları (FORCE_CHECKIN, EARLY_FINISH, CANCEL, MARK_NO_SHOW)
    // Not: EXTEND_1H (+1 Saat Uzatma) tamamen kaldırılmıştır.
    if (action === "RESERVATION_OP") {
      const { reservationId, op } = payload;
      const target = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          user: true,
          room: true,
          participants: {
            where: { status: "ACCEPTED" },
            include: { user: true },
          },
        },
      });

      if (!target) {
        return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
      }

      if (op === "FORCE_CHECKIN") {
        await prisma.reservation.update({
          where: { id: reservationId },
          data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInById: adminId },
        });
        await sendKioskCheckInEmailToStaff(reservationId, session.user.email);
        await prisma.adminAction.create({
          data: {
            adminId,
            actionType: "RESERVATION_FORCE_CHECKIN",
            targetEntityType: "Reservation",
            targetEntityId: reservationId,
            description: `${target.room.roomNumber} odası için görevli tarafından manuel Check-In yapıldı.`,
          },
        });
      } else if (op === "EARLY_FINISH") {
        const { currentHour, currentMinute } = getIstanbulDateInfo();
        const origStartH = new Date(target.startTime).getUTCHours();
        const origEndH = new Date(target.endTime).getUTCHours();

        let newEndTime = target.endTime;
        if (currentHour >= origStartH && currentHour < origEndH) {
          newEndTime = new Date(Date.UTC(1970, 0, 1, currentHour, currentMinute, 0));
        }

        await prisma.reservation.update({
          where: { id: reservationId },
          data: { status: "COMPLETED", endTime: newEndTime },
        });
        await prisma.adminAction.create({
          data: {
            adminId,
            actionType: "RESERVATION_OVERRIDE",
            targetEntityType: "Reservation",
            targetEntityId: reservationId,
            description: `${target.room.roomNumber} odası erken boşaltıldı (COMPLETED) ve kalan süre boşa çıkarıldı.`,
          },
        });
      } else if (op === "CANCEL") {
        await prisma.reservation.update({
          where: { id: reservationId },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: `Kütüphane görevlisi (${session.user.email}) tarafından iptal edildi.`,
          },
        });
        await prisma.adminAction.create({
          data: {
            adminId,
            actionType: "RESERVATION_FORCE_CANCEL",
            targetEntityType: "Reservation",
            targetEntityId: reservationId,
            description: `${target.room.roomNumber} rezervasyonu görevli tarafından iptal edildi.`,
          },
        });
      } else if (op === "MARK_NO_SHOW") {
        // Kiosk'tan kişisel kodunu girmeyen üyeleri tespit et ve 1/3 uyarı maili gönder!
        const checkedSetKey = `kiosk:checked_users:${reservationId}`;
        const checkedUserIds = await redis.smembers(checkedSetKey);

        const allApprovedUsers = [
          target.user,
          ...target.participants.map((p) => p.user),
        ];

        // Kodu girmeyenleri filtrele (Hiç kimse girmediyse tüm grup, bazıları girdiyse sadece girmeyenler)
        const absentUsers = allApprovedUsers.filter((u) => !checkedUserIds.includes(u.id));
        const usersToPenalize = absentUsers.length > 0 ? absentUsers : allApprovedUsers;

        // Eğer hiç kimse gelmediyse odayı NO_SHOW yap; gelenler varsa oda açık kalır sadece gelmeyenler uyarı alır
        if (checkedUserIds.length < 2) {
          await prisma.reservation.update({
            where: { id: reservationId },
            data: { status: "NO_SHOW", noShow: true, penaltyApplied: true },
          });
        } else {
          await prisma.reservation.update({
            where: { id: reservationId },
            data: { penaltyApplied: true },
          });
        }

        const roomLabel = `${target.room.roomNumber} (${target.room.name})`;
        const dateStr = new Date(target.reservationDate).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });

        const autoBannedNames = [];

        for (const member of usersToPenalize) {
          await prisma.penaltyHistory.create({
            data: {
              userId: member.id,
              reservationId,
              penaltyType: "NO_SHOW",
              penaltyPoints: 15,
              description: `${roomLabel} rezervasyonunda kişisel Kiosk kodu girilmedi (No-Show Uyarısı).`,
              createdBy: adminId,
            },
          });

          const activeNoShowCount = await prisma.penaltyHistory.count({
            where: {
              userId: member.id,
              penaltyType: "NO_SHOW",
              isActive: true,
            },
          });

          const shouldBan = activeNoShowCount >= 3;
          const banUntilDate = shouldBan
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : undefined;

          await prisma.user.update({
            where: { id: member.id },
            data: {
              penaltyPoints: { increment: 15 },
              ...(shouldBan && {
                isBanned: true,
                banUntil: banUntilDate,
                banReason: `Dönem içinde 3 kez No-Show (Kiosk kodu girmeme) ihlali nedeniyle 30 gün otomatik banlandı.`,
              }),
            },
          });

          // Öğrenciye 1/3, 2/3 veya 3/3 Uyarı/Ban E-postası Gönder
          await sendNoShowWarningEmail({
            user: member,
            activeNoShowCount,
            roomLabel,
            dateStr,
            isBanned: shouldBan,
            banUntilDate,
          });

          if (shouldBan) {
            autoBannedNames.push(member.email);
            await prisma.reservation.updateMany({
              where: {
                userId: member.id,
                status: { in: ["PENDING", "CONFIRMED"] },
                reservationDate: { gte: new Date() },
              },
              data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
                cancellationReason: "Kullanıcı 3. No-Show uyarısına ulaşıp banlandığı için otomatik iptal edildi.",
              },
            });
          }
        }

        await prisma.adminAction.create({
          data: {
            adminId,
            actionType: "PENALTY_ADDED",
            targetEntityType: "Reservation",
            targetEntityId: reservationId,
            description: `${roomLabel} için Kiosk kodu girmeyen ${usersToPenalize.length} üyeye No-Show uyarısı ve maili gönderildi.${
              autoBannedNames.length > 0
                ? ` 3/3 uyarı dolduğu için otomatik banlananlar: ${autoBannedNames.join(", ")}`
                : ""
            }`,
          },
        });

        return NextResponse.json({
          success: true,
          autoBannedNames,
          penalizedCount: usersToPenalize.length,
        });
      }

      return NextResponse.json({ success: true });
    }

    // 6. Duyuru Yayınla / Sil
    if (action === "CREATE_ANNOUNCEMENT") {
      const { titleTr, titleEn, contentTr, contentEn, priority } = payload;
      const created = await prisma.announcement.create({
        data: {
          title: { tr: titleTr, en: titleEn || titleTr },
          content: { tr: contentTr, en: contentEn || contentTr },
          priority: priority || "MEDIUM",
          isPinned: priority === "HIGH" || priority === "URGENT",
          isActive: true,
          createdBy: adminId,
          publishedAt: new Date(),
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "ANNOUNCEMENT_CREATED",
          targetEntityType: "Announcement",
          targetEntityId: created.id,
          description: `Yeni duyuru yayınlandı: ${titleTr}`,
        },
      });

      return NextResponse.json({ success: true, announcement: created });
    }

    if (action === "DELETE_ANNOUNCEMENT") {
      const { id } = payload;
      await prisma.announcement.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    //  Dönemsel veya Gün Seçmeli Banlama (BAN_USER) + Ban Açma + Ceza Sıfırlama
    if (action === "USER_MODERATION") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Bu işlem için İdare/Admin yetkisi gereklidir." }, { status: 403 });
      }

      const { targetUserId, modType, role, banDuration, banReason } = payload;

      if (modType === "BAN_USER") {
        // banDuration: 7, 14, 30 veya "SEMESTER" (180 gün - Dönem Boyu)
        const days = banDuration === "SEMESTER" ? 180 : Number(banDuration) || 30;
        const banUntilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        const durationLabel = banDuration === "SEMESTER" ? "Dönem Sonuna Kadar (180 Gün)" : `${days} Gün`;
        const finalReason = banReason?.trim() || `Kütüphane İdaresi tarafından ${durationLabel} süreyle yasaklandı.`;

        const bannedUser = await prisma.user.update({
          where: { id: targetUserId },
          data: {
            isBanned: true,
            banUntil: banUntilDate,
            banReason: finalReason,
          },
        });

        // Banlanan öğrencinin gelecekteki randevularını iptal et
        await prisma.reservation.updateMany({
          where: {
            userId: targetUserId,
            status: { in: ["PENDING", "CONFIRMED"] },
            reservationDate: { gte: new Date() },
          },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancellationReason: `Kullanıcı idare tarafından (${durationLabel}) banlandığı için iptal edildi.`,
          },
        });

        await prisma.emailQueue.create({
          data: {
            to: bannedUser.email,
            subject: `THKÜ Kütüphane - Rezervasyon Yasağı (${durationLabel}) Bildirimi`,
            body: `Sayın ${bannedUser.fullName},\n\nKütüphane çalışma odası rezervasyon yetkiniz ${banUntilDate.toLocaleDateString("tr-TR")} tarihine kadar (${durationLabel}) askıya alınmıştır.\n\nSebep: ${finalReason}`,
            priority: 1,
            status: "PENDING",
          },
        });

        await prisma.adminAction.create({
          data: {
            adminId,
            actionType: "USER_BANNED",
            targetEntityType: "User",
            targetEntityId: targetUserId,
            description: `${bannedUser.email} kullanıcısı ${durationLabel} süreyle banlandı. Sebep: ${finalReason}`,
          },
        });
      } else if (modType === "UNBAN") {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { isBanned: false, banUntil: null, banReason: null, penaltyPoints: 0 },
        });
        await prisma.penaltyHistory.updateMany({
          where: { userId: targetUserId, isActive: true },
          data: { isActive: false },
        });
        await prisma.adminAction.create({
          data: {
            adminId,
            actionType: "USER_UNBANNED",
            targetEntityType: "User",
            targetEntityId: targetUserId,
            description: "Öğrencinin yasağı (ban) kaldırıldı ve aktif No-Show uyarı sayacı sıfırlandı.",
          },
        });
      } else if (modType === "RESET_PENALTY") {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { penaltyPoints: 0 },
        });
        await prisma.penaltyHistory.updateMany({
          where: { userId: targetUserId, isActive: true },
          data: { isActive: false },
        });
        await prisma.adminAction.create({
          data: {
            adminId,
            actionType: "PENALTY_REMOVED",
            targetEntityType: "User",
            targetEntityId: targetUserId,
            description: "Öğrencinin ceza puanları ve No-Show uyarı sayacı sıfırlandı.",
          },
        });
      } else if (modType === "CHANGE_ROLE") {
        if (role === "SUPER_ADMIN" && currentRole !== "SUPER_ADMIN") {
          return NextResponse.json({ error: "Sadece BİM (SUPER_ADMIN) bu rolü atayabilir." }, { status: 403 });
        }
        await prisma.user.update({
          where: { id: targetUserId },
          data: { role },
        });
      }

      return NextResponse.json({ success: true });
    }

    // 8. Dinamik Rezervasyon Kuralı Güncelle 
    if (action === "UPDATE_RULE") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Kural değiştirme yetkisi sadece İdare/Admin rolündedir." }, { status: 403 });
      }
      const { ruleName, value } = payload;
      await prisma.reservationRule.upsert({
        where: { ruleName },
        update: { ruleValue: { value: Number(value) }, updatedBy: adminId },
        create: { ruleName, ruleType: "INTEGER", ruleValue: { value: Number(value) }, isActive: true, updatedBy: adminId },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "RULE_UPDATED",
          targetEntityType: "ReservationRule",
          description: `${ruleName} kuralı ${value} olarak güncellendi.`,
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    console.error("Admin POST error:", error);
    return NextResponse.json({ error: "İşlem sırasında hata oluştu." }, { status: 500 });
  }
}