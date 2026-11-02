import prisma from "@/lib/db";
import { getIstanbulTimeDetails } from "@/lib/timeUtils";
import { sendReservationCancelledEmails } from "@/lib/emailService";

export const RULE_DEFAULTS = {
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 8,
  MAX_DURATION_HOURS: 3,
  MAX_ADVANCE_DAYS: 1,
  DAILY_RELEASE_HOUR: 8,
  CHECKIN_TOLERANCE_MINUTES: 15,
  CANCEL_LOCK_MINUTES: 60,
};

/**
 * Veritabanındaki aktif rezervasyon kurallarını varsayılan değerlerle birleştirerek döndürür.
 */
export async function getActiveReservationRules() {
  const ruleNames = Object.keys(RULE_DEFAULTS);
  const rows = await prisma.reservationRule.findMany({
    where: { isActive: true, ruleName: { in: ruleNames } },
    select: { ruleName: true, ruleValue: true },
  });

  const map = Object.fromEntries(rows.map((r) => [r.ruleName, r.ruleValue?.value]));
  const getVal = (key) => Number(map[key] ?? RULE_DEFAULTS[key]);

  return {
    minParticipants: Math.max(2, getVal("MIN_PARTICIPANTS")),
    maxParticipants: getVal("MAX_PARTICIPANTS"),
    maxDurationHours: getVal("MAX_DURATION_HOURS"),
    maxAdvanceDays: getVal("MAX_ADVANCE_DAYS"),
    dailyReleaseHour: getVal("DAILY_RELEASE_HOUR"),
    checkinToleranceMinutes: getVal("CHECKIN_TOLERANCE_MINUTES"),
    cancelLockMinutes: getVal("CANCEL_LOCK_MINUTES"),
  };
}

/**
 * Belirtilen kullanıcıların (organizatör veya onaylı katılımcı olarak) aynı gün içinde
 * başka bir aktif/tamamlanmış randevusu olup olmadığını kontrol eder.
 */
export async function validateDailyQuotaForUsers({
  userIds,
  creatorId = null,
  reservationDateObj,
  excludeReservationId = null,
}) {
  const existingBooking = await prisma.reservation.findFirst({
    where: {
      ...(excludeReservationId && { id: { not: excludeReservationId } }),
      reservationDate: reservationDateObj,
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
      OR: [
        { userId: { in: userIds } },
        {
          participants: {
            some: {
              userId: { in: userIds },
              status: "ACCEPTED",
            },
          },
        },
      ],
    },
    include: {
      user: { select: { email: true, fullName: true } },
      participants: {
        where: { userId: { in: userIds }, status: "ACCEPTED" },
        include: { user: { select: { email: true, fullName: true } } },
      },
    },
  });

  if (!existingBooking) return { valid: true };

  if (creatorId) {
    const isCreatorBusy =
      existingBooking.userId === creatorId ||
      existingBooking.participants.some((p) => p.userId === creatorId);

    if (isCreatorBusy) {
      return {
        valid: false,
        error:
          "Aynı gün içinde (organizatör veya katılımcı olarak) yalnızca 1 adet rezervasyon hakkınız bulunmaktadır.",
      };
    }

    const busyMember = userIds.includes(existingBooking.userId)
      ? existingBooking.user.email
      : existingBooking.participants[0]?.user?.email;

    return {
      valid: false,
      error: `Grubunuzdaki ${busyMember} öğrencisinin seçilen tarihte zaten aktif bir rezervasyonu bulunmaktadır.`,
    };
  }

  return {
    valid: false,
    error:
      "Bu tarihte zaten aktif bir rezervasyonunuz bulunduğu için ikinci bir gruba katılamazsınız (Günlük 1 Rezervasyon Kuralı).",
  };
}

/**
 * 21:00 - 24:00 arası gece randevusu olanların ertesi sabah 00:00 - 08:00 arasına (veya tersi)
 * randevu almasını / katılmasını engelleyen ortak kural doğrulayıcı.
 */
export async function validateNightToMorningRuleForUsers({
  userIds,
  reservationDateObj,
  startTotalMins,
  endTotalMins,
}) {
  const baseTimeMs = new Date(reservationDateObj).getTime();

  if (startTotalMins < 8 * 60) {
    const prevDayObj = new Date(baseTimeMs - 24 * 60 * 60 * 1000);
    const nightThreshold = new Date("1970-01-01T21:00:00Z");

    const prevNightBooking = await prisma.reservation.findFirst({
      where: {
        reservationDate: prevDayObj,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
        endTime: { gt: nightThreshold },
        OR: [
          { userId: { in: userIds } },
          { participants: { some: { userId: { in: userIds }, status: "ACCEPTED" } } },
        ],
      },
      select: { id: true },
    });

    if (prevNightBooking) {
      return {
        valid: false,
        error:
          "Kütüphane kuralları gereği bir önceki gece 21:00 - 24:00 saatleri arasında randevusu bulunan kullanıcılar, ertesi gün 00:00 - 08:00 saatleri arasına randevu alamazlar.",
      };
    }
  }

  if (endTotalMins > 21 * 60) {
    const nextDayObj = new Date(baseTimeMs + 24 * 60 * 60 * 1000);
    const morningThreshold = new Date("1970-01-01T08:00:00Z");

    const nextMorningBooking = await prisma.reservation.findFirst({
      where: {
        reservationDate: nextDayObj,
        status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"] },
        startTime: { lt: morningThreshold },
        OR: [
          { userId: { in: userIds } },
          { participants: { some: { userId: { in: userIds }, status: "ACCEPTED" } } },
        ],
      },
      select: { id: true },
    });

    if (nextMorningBooking) {
      return {
        valid: false,
        error:
          "Ertesi gün 00:00 - 08:00 saatleri arasında randevusu bulunan kullanıcılar, bir önceki gece 21:00 - 24:00 saatleri arasına randevu alamazlar.",
      };
    }
  }

  return { valid: true };
}

/**
 * Banlanan bir kullanıcının organizatör olduğu gelecek randevuları iptal eder (gruba e-posta gönderir)
 * ve katılımcı olduğu gelecek randevulardan çıkarır (grup min kişi altına düşerse o randevuyu da iptal eder).
 */
export async function cancelOrRemoveBannedUserReservations({
  userId,
  userEmail,
  reasonText,
}) {
  const { todayDate } = getIstanbulTimeDetails();
  const { minParticipants } = await getActiveReservationRules();
  const now = new Date();

  // 1. Kullanıcının organizatör olduğu gelecek randevuları bul ve iptal et
  const organizerBookings = await prisma.reservation.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "CONFIRMED"] },
      reservationDate: { gte: todayDate },
    },
    select: { id: true, status: true },
  });

  for (const booking of organizerBookings) {
    const wasConfirmed = booking.status === "CONFIRMED";
    await prisma.reservation.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: reasonText,
      },
    });

    sendReservationCancelledEmails({
      reservationId: booking.id,
      cancelledByEmail: userEmail || "Sistem (Disiplin/Ban)",
      reason: reasonText,
      wasConfirmed,
    }).catch((err) => console.error("Ban organizer cancel email error:", err));
  }

  // 2. Kullanıcının katılımcı olduğu gelecek randevuları kontrol et
  const participations = await prisma.reservationParticipant.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "ACCEPTED"] },
      reservation: {
        status: { in: ["PENDING", "CONFIRMED"] },
        reservationDate: { gte: todayDate },
      },
    },
    include: {
      reservation: {
        include: {
          participants: true,
        },
      },
    },
  });

  for (const part of participations) {
    await prisma.reservationParticipant.update({
      where: { id: part.id },
      data: { status: "REJECTED" },
    });

    const remainingActiveParticipants = part.reservation.participants.filter(
      (p) => p.id !== part.id && ["ACCEPTED", "PENDING"].includes(p.status)
    );
    const remainingAcceptedParticipants = part.reservation.participants.filter(
      (p) => p.id !== part.id && p.status === "ACCEPTED"
    );

    const maxPossibleGroupSize = 1 + remainingActiveParticipants.length;
    const confirmedGroupSize = 1 + remainingAcceptedParticipants.length;

    if (
      (part.reservation.status === "PENDING" && maxPossibleGroupSize < minParticipants) ||
      (part.reservation.status === "CONFIRMED" && confirmedGroupSize < minParticipants)
    ) {
      const wasConfirmed = part.reservation.status === "CONFIRMED";
      const groupCancelReason = `Grup üyesi (${userEmail}) hesabının askıya alınması nedeniyle gruptan çıkarıldı ve minimum ${minParticipants} kişi şartı sağlanamadığı için randevu iptal edildi.`;

      await prisma.reservation.update({
        where: { id: part.reservationId },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason: groupCancelReason,
        },
      });

      sendReservationCancelledEmails({
        reservationId: part.reservationId,
        cancelledByEmail: "Sistem (Grup Yetersizliği)",
        reason: groupCancelReason,
        wasConfirmed,
      }).catch((err) => console.error("Ban participant cancel email error:", err));
    }
  }
}

