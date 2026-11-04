import prisma from "@/lib/db";
import { composeNoShowWarning, queueSafeEmail, sendNoShowWarningEmail } from "@/lib/emailService";
import { cancelOrRemoveBannedUserReservations } from "@/lib/reservationPolicy";

export async function persistNoShowForUser(tx, {
  member,
  reservationId,
  roomLabel,
  dateStr,
  timeRangeStr = "",
  description,
  auditUserId = member.id,
}) {
  await tx.penaltyHistory.create({
    data: {
      userId: member.id,
      reservationId,
      penaltyType: "NO_SHOW",
      penaltyPoints: 15,
      description,
    },
  });

  const activeNoShowCount = await tx.penaltyHistory.count({
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

  await tx.user.update({
    where: { id: member.id },
    data: {
      penaltyPoints: { increment: 15 },
      ...(shouldBan && {
        isBanned: true,
        banUntil: banUntilDate,
        banReason:
          "Dönem içinde 3 kez No-Show (Kapı QR onayı vermeme) ihlali nedeniyle 30 gün otomatik banlandı.",
      }),
    },
  });

  if (auditUserId !== null) {
    await tx.auditLog.create({
      data: {
        userId: auditUserId,
        action: shouldBan ? "AUTO_NO_SHOW_BANNED" : "AUTO_NO_SHOW_PENALTY",
        entityType: "Reservation",
        entityId: reservationId,
        newData: {
          room: roomLabel,
          date: dateStr,
          time: timeRangeStr,
          student: `${member.fullName} (${member.email})`,
          warningCount: `${activeNoShowCount}/3`,
          banUntil: shouldBan && banUntilDate ? banUntilDate.toLocaleDateString("tr-TR") : null,
        },
      },
    });
  }

  const warning = composeNoShowWarning({
    user: member,
    activeNoShowCount,
    roomLabel,
    dateStr,
    isBanned: shouldBan,
    banUntilDate,
  });

  await tx.notification.create({
    data: {
      userId: member.id,
      title: warning.subject,
      message: warning.body,
      type: shouldBan ? "BAN_WARNING" : "PENALTY",
    },
  });

  return {
    shouldBan,
    banUntilDate,
    activeNoShowCount,
    email: {
      to: member.email,
      subject: warning.subject,
      body: warning.body,
      htmlBody: warning.htmlBody,
      priority: 1,
    },
  };
}

/**
 * Hem otonom lifecycle motoru hem de Admin "MARK_NO_SHOW" operasyonu tarafından
 * ortak kullanılan DRY No-Show ceza ve 3/3 otomatik 30 gün ban servisi.
 */
export async function applyNoShowPenaltiesForUsers({
  usersToPenalize,
  reservationId,
  roomLabel,
  dateStr,
  timeRangeStr = "",
  descriptionPrefix = "",
  writeAuditLog = true,
}) {
  const autoBannedEmails = [];

  for (const member of usersToPenalize) {
    const desc =
      descriptionPrefix ||
      `${roomLabel} ${timeRangeStr ? `(${timeRangeStr}) ` : ""}rezervasyonunda kapı QR onayı verilmedi (No-Show Uyarısı).`;

    await prisma.penaltyHistory.create({
      data: {
        userId: member.id,
        reservationId,
        penaltyType: "NO_SHOW",
        penaltyPoints: 15,
        description: desc,
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
          banReason:
            "Dönem içinde 3 kez No-Show (Kapı QR onayı vermeme) ihlali nedeniyle 30 gün otomatik banlandı.",
        }),
      },
    });

    if (writeAuditLog) {
      await prisma.auditLog.create({
        data: {
          userId: member.id,
          action: shouldBan ? "AUTO_NO_SHOW_BANNED" : "AUTO_NO_SHOW_PENALTY",
          entityType: "Reservation",
          entityId: reservationId,
          newData: {
            room: roomLabel,
            date: dateStr,
            time: timeRangeStr,
            student: `${member.fullName} (${member.email})`,
            warningCount: `${activeNoShowCount}/3`,
            banUntil: shouldBan && banUntilDate ? banUntilDate.toLocaleDateString("tr-TR") : null,
          },
        },
      });
    }

    await sendNoShowWarningEmail({
      user: member,
      activeNoShowCount,
      roomLabel,
      dateStr,
      isBanned: shouldBan,
      banUntilDate,
    });

    if (shouldBan) {
      autoBannedEmails.push(member.email);
      await cancelOrRemoveBannedUserReservations({
        userId: member.id,
        userEmail: member.email,
        reasonText:
          "Kullanıcı 3. No-Show uyarısına ulaşıp banlandığı için otomatik iptal edildi.",
      });
    }
  }

  return {
    autoBannedEmails,
    penalizedCount: usersToPenalize.length,
  };
}

export { queueSafeEmail };
