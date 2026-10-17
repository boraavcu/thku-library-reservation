import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

const STAFF_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  try {
    const isSuper = session.user.role === "SUPER_ADMIN";

    const [rooms, reservations, announcements, users, rules, auditLogs, userAuditLogs] = await Promise.all([
      prisma.room.findMany({ orderBy: { roomNumber: "asc" } }),
      prisma.reservation.findMany({
        take: 50,
        orderBy: [{ reservationDate: "desc" }, { startTime: "asc" }],
        include: {
          room: { select: { roomNumber: true, name: true } },
          user: { select: { id: true, fullName: true, email: true, studentNumber: true } },
          participants: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        },
      }),
      prisma.announcement.findMany({
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 20,
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
          isActive: true,
          _count: {
            select: {
              penaltyHistory: { where: { penaltyType: "NO_SHOW", isActive: true } },
            },
          },
        },
      }),
      prisma.reservationRule.findMany({
        where: { isActive: true },
        orderBy: { ruleName: "asc" },
      }),
      isSuper
        ? prisma.adminAction.findMany({
            take: 40,
            orderBy: { createdAt: "desc" },
            include: {
              admin: { select: { fullName: true, email: true, role: true } },
              affectedUser: { select: { fullName: true, email: true } },
            },
          })
        : Promise.resolve([]),
      isSuper
        ? prisma.auditLog.findMany({
            take: 60,
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: { fullName: true, email: true, role: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      rooms,
      reservations,
      announcements,
      users,
      rules,
      auditLogs,
      userAuditLogs,
    });
  } catch (error) {
    console.error("Admin GET error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, payload } = body;
    const adminId = session.user.id;
    const currentRole = session.user.role;

    // 1. Odayı Aç/Kapat
    if (action === "TOGGLE_ROOM") {
      const { roomId, isActive, capacity, name } = payload;
      const updated = await prisma.room.update({
        where: { id: roomId },
        data: {
          ...(typeof isActive === "boolean" && { isActive }),
          ...(capacity && { capacity: Number(capacity) }),
          ...(name && { name: name.trim() }),
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: isActive === false ? "ROOM_DEACTIVATED" : "ROOM_UPDATED",
          targetEntityType: "Room",
          targetEntityId: roomId,
          description: `${updated.roomNumber} (${updated.name}) durumu güncellendi (Aktif: ${updated.isActive}).`,
        },
      });

      return NextResponse.json({ success: true, room: updated });
    }

    // 2. Yeni Çalışma Odası Ekle
    if (action === "CREATE_ROOM") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Yeni oda ekleme yetkisi sadece İdare/Admin rolündedir." }, { status: 403 });
      }
      const { roomNumber, name, capacity } = payload;
      if (!roomNumber || !name) {
        return NextResponse.json({ error: "Oda numarası ve adı zorunludur." }, { status: 400 });
      }

      const created = await prisma.room.create({
        data: {
          roomNumber: roomNumber.trim().toUpperCase(),
          name: name.trim(),
          capacity: Number(capacity) || 7,
          isActive: true,
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "ROOM_CREATED",
          targetEntityType: "Room",
          targetEntityId: created.id,
          description: `Yeni çalışma odası açıldı: ${created.roomNumber} - ${created.name}`,
        },
      });

      return NextResponse.json({ success: true, room: created });
    }

    // 3. Manuel Check-In
    if (action === "FORCE_CHECKIN") {
      const { reservationId } = payload;
      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInById: adminId },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "RESERVATION_FORCE_CHECKIN",
          targetEntityType: "Reservation",
          targetEntityId: reservationId,
          affectedUserId: updated.userId,
          description: "Görevli tarafından manuel check-in yapıldı.",
        },
      });

      return NextResponse.json({ success: true });
    }

    // 4. MADDE 3 & 3.1: Görevli Tarafından Rezervasyon Süresini +1 Saat Uzatma
    if (action === "EXTEND_RESERVATION") {
      const { reservationId, extraHours = 1 } = payload;
      const resRecord = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { room: true },
      });

      if (!resRecord) {
        return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
      }

      const currentEndHour = new Date(resRecord.endTime).getUTCHours();
      const currentEndMin = new Date(resRecord.endTime).getUTCMinutes();
      const targetEndHour = currentEndHour + Number(extraHours);

      if (targetEndHour > 22) {
        return NextResponse.json(
          { error: "Kütüphane kapanış saati (22:00) aşıldığı için süre uzatılamaz." },
          { status: 400 }
        );
      }

      const newEndTime = new Date(Date.UTC(1970, 0, 1, targetEndHour, currentEndMin, 0));

      // Uzatılmak istenen saatte başka bir rezervasyon var mı kontrol et
      const conflict = await prisma.reservation.findFirst({
        where: {
          id: { not: reservationId },
          roomId: resRecord.roomId,
          reservationDate: resRecord.reservationDate,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          AND: [
            { startTime: { lt: newEndTime } },
            { endTime: { gt: resRecord.endTime } },
          ],
        },
      });

      if (conflict) {
        return NextResponse.json(
          { error: "Odanın bir sonraki saat dilimi başka bir grup tarafından rezerve edildiği için süre uzatılamaz." },
          { status: 409 }
        );
      }

      await prisma.reservation.update({
        where: { id: reservationId },
        data: { endTime: newEndTime },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "SETTINGS_UPDATED",
          targetEntityType: "Reservation",
          targetEntityId: reservationId,
          affectedUserId: resRecord.userId,
          description: `${resRecord.room.roomNumber} odası rezervasyon süresi +${extraHours} saat uzatıldı (Yeni Bitiş: ${targetEndHour}:00).`,
        },
      });

      return NextResponse.json({ success: true });
    }

    // 5. MADDE 3.1 & 8: Görevli Tarafından Rezervasyonu Anlık Bitirme / Odayı Boşaltma
    if (action === "EARLY_CLOSE_RESERVATION") {
      const { reservationId } = payload;
      const resRecord = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: { room: true },
      });

      if (!resRecord) {
        return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
      }

      const now = new Date();
      const trParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Istanbul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const curH = Number(trParts.find((p) => p.type === "hour").value);
      const curM = Number(trParts.find((p) => p.type === "minute").value);

      const origStartH = new Date(resRecord.startTime).getUTCHours();
      const origEndH = new Date(resRecord.endTime).getUTCHours();

      let adjustedEnd = resRecord.endTime;
      if (curH >= origStartH && curH < origEndH) {
        adjustedEnd = new Date(Date.UTC(1970, 0, 1, curH, curM, 0));
      }

      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: "COMPLETED",
          endTime: adjustedEnd,
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "RESERVATION_CANCELLED",
          targetEntityType: "Reservation",
          targetEntityId: reservationId,
          affectedUserId: resRecord.userId,
          description: `${resRecord.room.roomNumber} odası görevli tarafından erken sonlandırıldı ve kullanıma açıldı.`,
        },
      });

      return NextResponse.json({ success: true });
    }

    // 6. Rezervasyon İptali
    if (action === "CANCEL_RESERVATION") {
      const { reservationId, reason } = payload;
      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason || "Görevli tarafından iptal edildi.",
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "RESERVATION_CANCELLED",
          targetEntityType: "Reservation",
          targetEntityId: reservationId,
          affectedUserId: updated.userId,
          description: `Rezervasyon iptal edildi.`,
        },
      });

      return NextResponse.json({ success: true });
    }

    // 7. MADDE 1 & MADDE 4: No-Show'da Tüm Onaylı Üyelere Ceza + 3. No-Show'da 30 Gün Otomatik Ban
    if (action === "MARK_NO_SHOW") {
      const { reservationId, points = 15 } = payload;
      const resRecord = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          room: true,
          participants: { where: { status: "ACCEPTED" } },
        },
      });

      if (!resRecord) {
        return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
      }

      // Organizatör + Daveti ACCEPTED yapmış tüm grup üyeleri
      const targetUserIds = [
        resRecord.userId,
        ...resRecord.participants.map((p) => p.userId),
      ];
      const uniqueUserIds = [...new Set(targetUserIds)];

      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "NO_SHOW", noShow: true, penaltyApplied: true },
      });

      const autoBannedEmails = [];

      for (const uid of uniqueUserIds) {
        await prisma.penaltyHistory.create({
          data: {
            userId: uid,
            reservationId,
            penaltyType: "NO_SHOW",
            penaltyPoints: Number(points),
            description: `${resRecord.room.roomNumber} odası rezervasyonuna gelinmedi (No-Show).`,
            isActive: true,
          },
        });

        await prisma.user.update({
          where: { id: uid },
          data: { penaltyPoints: { increment: Number(points) } },
        });

        // Kullanıcının aktif NO_SHOW sayısını kontrol et (Madde 1: 3 kez No-Show = 30 Gün Ban)
        const activeNoShowCount = await prisma.penaltyHistory.count({
          where: {
            userId: uid,
            penaltyType: "NO_SHOW",
            isActive: true,
          },
        });

        if (activeNoShowCount >= 3) {
          const banUntilDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const bannedUser = await prisma.user.update({
            where: { id: uid },
            data: {
              isBanned: true,
              banUntil: banUntilDate,
              banReason: `Dönem içinde 3 kez No-Show (Rezervasyona Gelmeme) kural ihlali nedeniyle 30 gün otomatik yasaklama.`,
            },
          });

          autoBannedEmails.push(bannedUser.email);

          // Banlanan kullanıcının gelecekteki aktif rezervasyonlarını otomatik iptal et
          await prisma.reservation.updateMany({
            where: {
              userId: uid,
              status: { in: ["PENDING", "CONFIRMED"] },
            },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancellationReason: "Kullanıcı 3 kez No-Show nedeniyle 30 gün banlandığı için otomatik iptal edildi.",
            },
          });

          await prisma.adminAction.create({
            data: {
              adminId,
              actionType: "USER_BANNED",
              targetEntityType: "User",
              targetEntityId: uid,
              affectedUserId: uid,
              description: `${bannedUser.email} kullanıcısı 3. No-Show ihlaline ulaştığı için sistem tarafından otomatik olarak 30 gün banlandı.`,
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
          affectedUserId: resRecord.userId,
          description: `No-Show işlendi: ${uniqueUserIds.length} grup üyesine +${points} ceza puanı kesildi.${
            autoBannedEmails.length > 0 ? ` Otomatik 30 gün banlananlar: ${autoBannedEmails.join(", ")}` : ""
          }`,
        },
      });

      return NextResponse.json({
        success: true,
        penalizedCount: uniqueUserIds.length,
        autoBannedEmails,
      });
    }

    // 8. Duyuru Yayınla / Sil
    if (action === "CREATE_ANNOUNCEMENT") {
      const { titleTr, titleEn, contentTr, contentEn, priority = "MEDIUM", isPinned = false } = payload;
      if (!titleTr || !contentTr) {
        return NextResponse.json({ error: "Başlık ve içerik zorunludur." }, { status: 400 });
      }
      const announcement = await prisma.announcement.create({
        data: {
          title: { tr: titleTr.trim(), en: (titleEn || titleTr).trim() },
          content: { tr: contentTr.trim(), en: (contentEn || contentTr).trim() },
          priority,
          isPinned: Boolean(isPinned),
          isActive: true,
          publishedAt: new Date(),
          createdBy: adminId,
        },
      });
      return NextResponse.json({ success: true, announcement });
    }

    if (action === "DELETE_ANNOUNCEMENT") {
      await prisma.announcement.delete({ where: { id: payload.announcementId } });
      return NextResponse.json({ success: true });
    }

    // 9. Kullanıcı Ban Açma / Banlama / Ceza Sıfırlama (No-Show Geçmişini de Temizler) / Rol Verme
    if (action === "UPDATE_USER") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Bu işlem için Admin veya Super Admin yetkisi gereklidir." }, { status: 403 });
      }

      const { targetUserId, isBanned, banReason, resetPenalties, addPenaltyPoints, role } = payload;

      if (role && ["ADMIN", "SUPER_ADMIN"].includes(role) && currentRole !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "ADMIN veya SUPER_ADMIN rolünü yalnızca BİM Sistem Yöneticisi atayabilir." }, { status: 403 });
      }

      const updateData = {};
      let actionType = "USER_ROLE_CHANGED";
      let desc = "Kullanıcı güncellendi.";

      if (typeof isBanned === "boolean") {
        updateData.isBanned = isBanned;
        updateData.banReason = isBanned ? (banReason || "Kütüphane kuralları ihlali") : null;
        updateData.banUntil = isBanned ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
        actionType = isBanned ? "USER_BANNED" : "USER_UNBANNED";
        desc = isBanned ? "Kullanıcı 30 gün süreyle banlandı." : "Kullanıcının banı (yasağı) kaldırıldı.";

        // Ban kaldırıldığında aktif No-Show sayaçlarını da pasife çek ki hemen tekrar banlanmasın
        if (!isBanned) {
          await prisma.penaltyHistory.updateMany({
            where: { userId: targetUserId, isActive: true },
            data: { isActive: false },
          });
        }
      }

      if (resetPenalties) {
        updateData.penaltyPoints = 0;
        actionType = "PENALTY_REMOVED";
        desc = "Kullanıcının ceza puanları ve No-Show sayacı sıfırlandı.";
        await prisma.penaltyHistory.updateMany({
          where: { userId: targetUserId, isActive: true },
          data: { isActive: false },
        });
      }

      if (addPenaltyPoints) {
        updateData.penaltyPoints = { increment: Number(addPenaltyPoints) };
        actionType = "PENALTY_ADDED";
        desc = `Kullanıcıya +${addPenaltyPoints} ceza puanı eklendi.`;
      }

      if (role) {
        updateData.role = role;
        actionType = "USER_ROLE_CHANGED";
        desc = `Kullanıcı rolü ${role} olarak değiştirildi.`;
      }

      const updatedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: updateData,
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType,
          targetEntityType: "User",
          targetEntityId: targetUserId,
          affectedUserId: targetUserId,
          description: `${updatedUser.email}: ${desc}`,
        },
      });

      return NextResponse.json({ success: true, user: updatedUser });
    }

    // 10. Kütüphane Rezervasyon Kurallarını Güncelle
    if (action === "UPDATE_RULE") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 });
      }
      const { ruleName, value } = payload;
      await prisma.reservationRule.update({
        where: { ruleName },
        data: { ruleValue: { value: Number(value) } },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "SETTINGS_UPDATED",
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