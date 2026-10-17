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
    const [rooms, reservations, announcements, users, rules, auditLogs] = await Promise.all([
      prisma.room.findMany({ orderBy: { roomNumber: "asc" } }),
      prisma.reservation.findMany({
        take: 50,
        orderBy: [{ reservationDate: "desc" }, { startTime: "asc" }],
        include: {
          room: { select: { roomNumber: true, name: true } },
          user: { select: { id: true, fullName: true, email: true, studentNumber: true } },
          participants: { include: { user: { select: { fullName: true, email: true } } } },
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
        },
      }),
      prisma.reservationRule.findMany({
        where: { isActive: true },
        orderBy: { ruleName: "asc" },
      }),
      // Sadece SUPER_ADMIN için sistem denetim kayıtları (AdminAction)
      session.user.role === "SUPER_ADMIN"
        ? prisma.adminAction.findMany({
            take: 30,
            orderBy: { createdAt: "desc" },
            include: {
              admin: { select: { fullName: true, email: true, role: true } },
              affectedUser: { select: { fullName: true, email: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ rooms, reservations, announcements, users, rules, auditLogs });
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

    // 1. Odayı Aç/Kapat (LIBRARIAN, ADMIN, SUPER_ADMIN)
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

    // 2. Yeni Çalışma Odası Ekle (Sadece ADMIN ve SUPER_ADMIN)
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

    // 4. Rezervasyon İptali
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

    // 5. No-Show ve Ceza Puanı İşleme
    if (action === "MARK_NO_SHOW") {
      const { reservationId, points = 15 } = payload;
      const resRecord = await prisma.reservation.findUnique({ where: { id: reservationId } });
      if (!resRecord) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

      await prisma.$transaction([
        prisma.reservation.update({
          where: { id: reservationId },
          data: { status: "NO_SHOW", noShow: true, penaltyApplied: true },
        }),
        prisma.user.update({
          where: { id: resRecord.userId },
          data: { penaltyPoints: { increment: Number(points) } },
        }),
        prisma.penaltyHistory.create({
          data: {
            userId: resRecord.userId,
            reservationId,
            penaltyType: "NO_SHOW",
            penaltyPoints: Number(points),
            description: "Rezervasyon saatinde odaya giriş yapılmadı.",
          },
        }),
        prisma.adminAction.create({
          data: {
            adminId,
            actionType: "PENALTY_ADDED",
            targetEntityType: "Reservation",
            targetEntityId: reservationId,
            affectedUserId: resRecord.userId,
            description: `No-Show nedeniyle +${points} ceza puanı eklendi.`,
          },
        }),
      ]);

      return NextResponse.json({ success: true });
    }

    // 6. Duyuru Yayınla / Sil
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

    // 7. Kullanıcı Ban Açma / Banlama / Ceza Puanı Ekleme-Sıfırlama / Rol Verme
    if (action === "UPDATE_USER") {
      if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
        return NextResponse.json({ error: "Bu işlem için Admin veya Super Admin yetkisi gereklidir." }, { status: 403 });
      }

      const { targetUserId, isBanned, banReason, resetPenalties, addPenaltyPoints, role } = payload;

      // Sadece SUPER_ADMIN başka birine ADMIN veya SUPER_ADMIN rolü verebilir
      if (role && ["ADMIN", "SUPER_ADMIN"].includes(role) && currentRole !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "ADMIN veya SUPER_ADMIN rolünü yalnızca BİM Sistem Yöneticisi (SUPER_ADMIN) atayabilir." }, { status: 403 });
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
      }

      if (resetPenalties) {
        updateData.penaltyPoints = 0;
        actionType = "PENALTY_REMOVED";
        desc = "Kullanıcının ceza puanları sıfırlandı.";
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

    // 8. Kütüphane Rezervasyon Kurallarını Güncelle (ADMIN & SUPER_ADMIN)
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