import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import { getIstanbulTimeDetails, parseReservationMinutesUTC, fmtDateUTC } from "@/lib/timeUtils";
import {
  sendKioskCheckInEmailToStaff,
  sendReservationCancelledEmails,
  sendNoShowWarningEmail,
} from "@/lib/emailService";
import { applyNoShowPenaltiesForUsers } from "@/lib/penaltyService";

function requireAdminOrSuper(currentRole, customMsg) {
  if (!["ADMIN", "SUPER_ADMIN"].includes(currentRole)) {
    return NextResponse.json(
      { error: customMsg || "Bu işlem için İdare/Admin yetkisi gereklidir." },
      { status: 403 }
    );
  }
  return null;
}

export const ADMIN_ACTION_HANDLERS = {
  async TOGGLE_ROOM({ payload, adminId }) {
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
        description: `${room.roomNumber} (${room.name}) odası ${
          isActive
            ? "yeni rezervasyonlara açıldı"
            : "yeni rezervasyonlara kapatıldı (mevcut randevular korunuyor)"
        }.`,
      },
    });

    return NextResponse.json({ success: true, room });
  },

  async CREATE_ROOM({ payload, adminId, currentRole }) {
    const denied = requireAdminOrSuper(
      currentRole,
      "Yeni oda ekleme yetkisi sadece İdare/Admin rolündedir."
    );
    if (denied) return denied;

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
  },

  async UPDATE_ROOM({ payload, adminId, currentRole }) {
    const denied = requireAdminOrSuper(
      currentRole,
      "Oda bilgilerini düzenleme yetkisi sadece İdare/Admin rolündedir."
    );
    if (denied) return denied;

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
  },

  async DELETE_ROOM({ payload, adminId, currentRole }) {
    const denied = requireAdminOrSuper(
      currentRole,
      "Oda silme yetkisi sadece İdare/Admin rolündedir."
    );
    if (denied) return denied;

    const { roomId } = payload;
    const targetRoom = await prisma.room.findUnique({ where: { id: roomId } });
    if (!targetRoom) {
      return NextResponse.json({ error: "Oda bulunamadı." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.reservation.deleteMany({ where: { roomId } }),
      prisma.room.delete({ where: { id: roomId } }),
    ]);

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
  },

  async RESERVATION_OP({ payload, adminId, session }) {
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
      const allMemberIds = [target.user.id, ...target.participants.map((p) => p.user.id)];
      sendKioskCheckInEmailToStaff(reservationId, allMemberIds).catch(() => {});

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
      const { hour, minute, totalMins } = getIstanbulTimeDetails();
      const { startTotalMins, endTotalMins } = parseReservationMinutesUTC(target);

      let newEndTime = target.endTime;
      if (totalMins >= startTotalMins && totalMins < endTotalMins) {
        newEndTime = new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
      }

      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "COMPLETED", endTime: newEndTime },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "RESERVATION_CANCELLED",
          targetEntityType: "Reservation",
          targetEntityId: reservationId,
          description: `${target.room.roomNumber} odası erken boşaltıldı (COMPLETED) ve kalan süre boşa çıkarıldı.`,
        },
      });
    } else if (op === "CANCEL") {
      const wasConfirmed = ["CONFIRMED", "CHECKED_IN"].includes(target.status);
      const cancelReasonText = `Kütüphane görevlisi (${session.user.email}) tarafından iptal edildi.`;

      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: cancelReasonText,
        },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "RESERVATION_CANCELLED",
          targetEntityType: "Reservation",
          targetEntityId: reservationId,
          description: `${target.room.roomNumber} rezervasyonu görevli tarafından iptal edildi.`,
        },
      });

      sendReservationCancelledEmails({
        reservationId,
        cancelledByEmail: session.user.email,
        reason: cancelReasonText,
        wasConfirmed,
      }).catch((err) => console.error("Admin cancel email error:", err));
    } else if (op === "MARK_NO_SHOW") {
      const checkedSetKey = `kiosk:checked_users:${reservationId}`;
      const checkedUserIds = await redis.smembers(checkedSetKey);

      const allApprovedUsers = [target.user, ...target.participants.map((p) => p.user)];
      const absentUsers = allApprovedUsers.filter((u) => !checkedUserIds.includes(u.id));
      const usersToPenalize = absentUsers.length > 0 ? absentUsers : allApprovedUsers;

      await prisma.reservation.update({
        where: { id: reservationId },
        data:
          checkedUserIds.length < 2
            ? { status: "NO_SHOW", noShow: true, penaltyApplied: true }
            : { penaltyApplied: true },
      });

      const roomLabel = `${target.room.roomNumber} (${target.room.name})`;
      const dateStr = fmtDateUTC(target.reservationDate);

      const { autoBannedEmails, penalizedCount } = await applyNoShowPenaltiesForUsers({
        usersToPenalize,
        reservationId,
        roomLabel,
        dateStr,
        writeAuditLog: false,
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "PENALTY_ADDED",
          targetEntityType: "Reservation",
          targetEntityId: reservationId,
          description: `${roomLabel} için kapı QR onayı vermeyen ${penalizedCount} üyeye No-Show uyarısı işlendi.${
            autoBannedEmails.length > 0
              ? ` 3/3 uyarı dolduğu için otomatik banlananlar: ${autoBannedEmails.join(", ")}`
              : ""
          }`,
        },
      });

      return NextResponse.json({
        success: true,
        autoBannedNames: autoBannedEmails,
        penalizedCount,
      });
    }

    return NextResponse.json({ success: true });
  },

  async CREATE_ANNOUNCEMENT({ payload, adminId }) {
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
        actionType: "SETTINGS_UPDATED",
        targetEntityType: "Announcement",
        targetEntityId: created.id,
        description: `Yeni duyuru yayınlandı: ${titleTr}`,
      },
    });

    return NextResponse.json({ success: true, announcement: created });
  },

  async DELETE_ANNOUNCEMENT({ payload }) {
    const { id } = payload;
    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },

  async USER_MODERATION({ payload, adminId, currentRole }) {
    const denied = requireAdminOrSuper(currentRole);
    if (denied) return denied;

    const { targetUserId, modType, role, banMode, banUntilDateStr, banReason } = payload;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, fullName: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Hedef kullanıcı bulunamadı." }, { status: 404 });
    }

    if (modType === "BAN_USER") {
      const isPermanent = banMode === "PERMANENT";
      let banUntilDate = null;
      let durationLabel = "Kalıcı Olarak (Perma Ban)";

      if (!isPermanent) {
        if (!banUntilDateStr) {
          return NextResponse.json(
            { error: "Lütfen takvimden geçerli bir ban bitiş tarihi seçiniz." },
            { status: 400 }
          );
        }
        banUntilDate = new Date(`${banUntilDateStr}T23:59:59Z`);
        if (isNaN(banUntilDate.getTime()) || banUntilDate <= new Date()) {
          return NextResponse.json(
            { error: "Ban bitiş tarihi bugünden ileri bir tarih olmalıdır." },
            { status: 400 }
          );
        }
        durationLabel = `${banUntilDate.toLocaleDateString("tr-TR")} Tarihine Kadar`;
      }

      const finalReason =
        banReason?.trim() || `Kütüphane İdaresi tarafından (${durationLabel}) yasaklandı.`;

      const bannedUser = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          isBanned: true,
          banUntil: banUntilDate,
          banReason: finalReason,
        },
      });

      const { todayDate } = getIstanbulTimeDetails();

      await prisma.reservation.updateMany({
        where: {
          userId: targetUserId,
          status: { in: ["PENDING", "CONFIRMED"] },
          reservationDate: { gte: todayDate },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: `Kullanıcı idare tarafından (${durationLabel}) banlandığı için iptal edildi.`,
        },
      });

      await sendNoShowWarningEmail({
        user: bannedUser,
        activeNoShowCount: 3,
        roomLabel: "Genel Kütüphane Disiplin Kararı",
        dateStr: new Date().toLocaleDateString("tr-TR"),
        isBanned: true,
        banUntilDate,
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "USER_BANNED",
          targetEntityType: "User",
          targetEntityId: targetUserId,
          affectedUserId: targetUserId,
          description: `${bannedUser.email} kullanıcısı (${durationLabel}) banlandı. Sebep: ${finalReason}`,
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
          affectedUserId: targetUserId,
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
          affectedUserId: targetUserId,
          description: "Öğrencinin ceza puanları ve No-Show uyarı sayacı sıfırlandı.",
        },
      });
    } else if (modType === "CHANGE_ROLE") {
      if (currentRole === "ADMIN" && ["ADMIN", "SUPER_ADMIN"].includes(targetUser.role)) {
        return NextResponse.json(
          {
            error:
              "Yetki Kuralı: Kütüphane Müdürü (ADMIN), başka bir Admin veya Super Admin'in yetkisini değiştiremez.",
          },
          { status: 403 }
        );
      }

      if (currentRole === "ADMIN" && !["STUDENT", "LIBRARIAN"].includes(role)) {
        return NextResponse.json(
          {
            error:
              "Yetki Kuralı: Admin sadece Görevli (LIBRARIAN) atayabilir. Admin ve Super Admin atama yetkisi yalnızca BİM (SUPER_ADMIN) rolündedir.",
          },
          { status: 403 }
        );
      }

      await prisma.user.update({
        where: { id: targetUserId },
        data: { role },
      });

      await prisma.adminAction.create({
        data: {
          adminId,
          actionType: "USER_ROLE_CHANGED",
          targetEntityType: "User",
          targetEntityId: targetUserId,
          affectedUserId: targetUserId,
          description: `${targetUser.email} kullanıcısının rolü ${role} olarak güncellendi.`,
        },
      });
    }

    return NextResponse.json({ success: true });
  },

  async UPDATE_RULE({ payload, adminId, currentRole }) {
    const denied = requireAdminOrSuper(
      currentRole,
      "Kural değiştirme yetkisi sadece İdare/Admin rolündedir."
    );
    if (denied) return denied;

    const { ruleName, value } = payload;
    await prisma.reservationRule.upsert({
      where: { ruleName },
      update: { ruleValue: { value: Number(value) } },
      create: { ruleName, ruleType: "INTEGER", ruleValue: { value: Number(value) }, isActive: true },
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
  },
};