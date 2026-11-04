import prisma from "@/lib/db";
import {
  buildPenaltyTargets,
  claimNoShowCancellation,
  claimPenaltyApplied,
  createPrismaDb,
  listAttendanceUserIds,
} from "@/lib/kioskStore";
import {
  getIstanbulTimeDetails,
  getReservationKioskWindow,
  parseReservationMinutesUTC,
  fmtTimeUTC,
  fmtDateUTC,
  escapeHtml,
} from "@/lib/timeUtils";
import {
  ALLOWED_DIRECTOR_EMAIL,
  buildCorporateEmailHtml,
  composeNoShowWarning,
  queueSafeEmail,
  sendReservationInvitationEmails,
  handleParticipantAcceptedEmails,
  sendReservationCancelledEmails,
  sendKioskCheckInEmailToStaff,
  sendNoShowWarningEmail,
} from "@/lib/emailService";
import { applyNoShowPenaltiesForUsers, persistNoShowForUser } from "@/lib/penaltyService";
import {
  getActiveReservationRules,
  cancelOrRemoveBannedUserReservations,
} from "@/lib/reservationPolicy";

const INVITATION_TIMEOUT_MS = 30 * 60 * 1000;

export {
  ALLOWED_DIRECTOR_EMAIL,
  getIstanbulTimeDetails,
  getReservationKioskWindow,
  buildCorporateEmailHtml,
  composeNoShowWarning,
  persistNoShowForUser,
  queueSafeEmail,
  sendReservationInvitationEmails,
  handleParticipantAcceptedEmails,
  sendReservationCancelledEmails,
  sendKioskCheckInEmailToStaff,
  sendNoShowWarningEmail,
  applyNoShowPenaltiesForUsers,
};

async function executeLifecycleSweep() {
  const now = new Date();
  const thirtyMinsAgo = new Date(now.getTime() - INVITATION_TIMEOUT_MS);
  const { todayDate: todayDateObj, totalMins: nowMins } = getIstanbulTimeDetails(now);
  const nowEpochMins = Math.floor(todayDateObj.getTime() / 60000) + nowMins;

  // 1. 30 DAKİKALIK DAVET ONAY SÜRESİ DOLAN VEYA BİTİŞ SAATİ GEÇEN PENDING RANDEVULARIN OTOMATİK İPTALİ
  const pendingCandidates = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      OR: [
        { createdAt: { lt: thirtyMinsAgo } },
        { reservationDate: { lte: todayDateObj } },
      ],
    },
    include: { room: true, user: true },
  });

  for (const stale of pendingCandidates) {
    const resDateStr = new Date(stale.reservationDate).toISOString().split("T")[0];
    const resDayEpochMins = Math.floor(new Date(`${resDateStr}T00:00:00Z`).getTime() / 60000);
    const { endTotalMins } = parseReservationMinutesUTC(stale);
    const endEpochMins = resDayEpochMins + endTotalMins;

    const isInviteExpired = new Date(stale.createdAt).getTime() < thirtyMinsAgo.getTime();
    const isSlotEnded = nowEpochMins >= endEpochMins;

    if (!isInviteExpired && !isSlotEnded) continue;

    const reasonText = isSlotEnded
      ? "Randevu süresi onaylanmadan sona erdiği için otomatik iptal edildi."
      : "Gönderilen davetiyeler 30 dakika içinde onaylanmadığı için otomatik iptal edildi.";

    const updated = await prisma.reservation.updateMany({
      where: { id: stale.id, status: "PENDING" },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: reasonText,
      },
    });

    if (updated.count === 0) continue;

    const roomLabel = `${stale.room.roomNumber} - ${stale.room.name}`;
    const timeRangeStr = `${fmtTimeUTC(stale.startTime)} - ${fmtTimeUTC(stale.endTime)}`;

    await prisma.auditLog.create({
      data: {
        userId: stale.user.id,
        action: "AUTO_TIMEOUT_CANCELLED",
        entityType: "Reservation",
        entityId: stale.id,
        newData: {
          room: roomLabel,
          date: fmtDateUTC(stale.reservationDate),
          time: timeRangeStr,
          reason: reasonText,
        },
      },
    });

    const htmlBody = buildCorporateEmailHtml({
      badgeText: "SÜRE AŞIMI İPTALİ",
      badgeColor: "#B91C1C",
      badgeBg: "#FEE2E2",
      title: "Rezervasyon Talebiniz Onay Süresi Dolduğu İçin İptal Edildi",
      greeting: `Sayın ${stale.user.fullName},`,
      leadText: `${escapeHtml(roomLabel)} çalışma odası için oluşturduğunuz rezervasyon talebi, gönderilen grup davetiyeleri süresi içinde onaylanmadığı için sistem tarafından otomatik olarak iptal edilmiştir.`,
      details: [
        { label: "Çalışma Odası", value: roomLabel },
        { label: "Tarih", value: fmtDateUTC(stale.reservationDate) },
        { label: "Saat Aralığı", value: timeRangeStr },
        { label: "Durum", value: "İPTAL EDİLDİ (Onay Süresi Doldu)" },
      ],
    });

    await queueSafeEmail({
      to: stale.user.email,
      subject: "THKÜ Kütüphane - Rezervasyonunuz Onay Süresi Dolduğu İçin İptal Edildi",
      body: `Sayın ${stale.user.fullName}, ${roomLabel} odası için oluşturduğunuz rezervasyon talebi, grup davetiyeleri süresi içinde onaylanmadığı için otomatik olarak iptal edilmiştir.`,
      htmlBody,
      priority: 2,
    });
  }

  // 2. KAPI QR (KİOSK) SÜRESİ, SON 2 SAAT HATIRLATMA VE SÜRESİ BİTEN RANDEVULARI COMPLETED YAPMA
  const {
    checkinToleranceMinutes: toleranceMinutes,
    minParticipants: minRequiredPeople,
  } = await getActiveReservationRules();

  // Bugün ve geçmiş günlerdeki TÜM CONFIRMED ve CHECKED_IN randevuları tara
  // (penaltyApplied: true olsa bile süresi bittiğinde COMPLETED durumuna geçebilmesi için filtreleme yapılmaz)
  const activeCandidates = await prisma.reservation.findMany({
    where: {
      reservationDate: { lte: todayDateObj },
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    include: {
      room: true,
      user: true,
      participants: {
        where: { status: "ACCEPTED" },
        include: { user: true },
      },
    },
  });

  for (const res of activeCandidates) {
    const resDateStr = new Date(res.reservationDate).toISOString().split("T")[0];
    const resDayEpochMins = Math.floor(new Date(`${resDateStr}T00:00:00Z`).getTime() / 60000);
    const { endTotalMins } = parseReservationMinutesUTC(res);
    const { startTotalMins, maxAllowed: deadlineMins } = getReservationKioskWindow(
      res,
      resDateStr,
      toleranceMinutes
    );

    const startEpochMins = resDayEpochMins + startTotalMins;
    const deadlineEpochMins = resDayEpochMins + deadlineMins;
    const endEpochMins = resDayEpochMins + endTotalMins;
    const diffMins = startEpochMins - nowEpochMins;

    // A) Başlangıca 2 saat (120 dk) kala hatırlatma bildirimi
    if (res.status === "CONFIRMED" && diffMins > 0 && diffMins <= 120) {
      const alreadySent = await prisma.notification.findFirst({
        where: { relatedEntityId: res.id, type: "RESERVATION_REMINDER" },
        select: { id: true },
      });

      if (!alreadySent) {
        const allMembers = [res.user, ...res.participants.map((p) => p.user)];
        const timeRangeStr = `${fmtTimeUTC(res.startTime)} - ${fmtTimeUTC(res.endTime)}`;
        const roomLabel = `${res.room.roomNumber} - ${res.room.name}`;

        for (const member of allMembers) {
          await prisma.notification.create({
            data: {
              userId: member.id,
              title: "Randevunuza Son 2 Saat Kaldı",
              message: `${roomLabel} odasındaki (${timeRangeStr}) randevunuzun başlamasına 2 saatten az kalmıştır. Son 1 saat içinde iptal yapılamaz.`,
              type: "RESERVATION_REMINDER",
              relatedEntityType: "Reservation",
              relatedEntityId: res.id,
            },
          });

          const htmlBody = buildCorporateEmailHtml({
            badgeText: "HATIRLATMA • SON 2 SAAT",
            badgeColor: "#B45309",
            badgeBg: "#FEF3C7",
            title: "Çalışma Odası Randevunuza Son 2 Saat Kaldı",
            greeting: `Sayın ${member.fullName},`,
            leadText: `${escapeHtml(roomLabel)} çalışma odasındaki grup randevunuzun başlamasına 2 saatten az süre kalmıştır.`,
            details: [
              { label: "Çalışma Odası", value: roomLabel },
              { label: "Tarih", value: fmtDateUTC(res.reservationDate) },
              { label: "Saat Aralığı", value: timeRangeStr },
              { label: "Çalışma Amacı", value: res.purpose || "Grup Çalışması" },
            ],
            rulesTitle: "Önemli Kütüphane Kuralları",
            rulesList: [
              "Randevu başlangıç saatine 1 saat (60 dakika) kala iptal işlemi kilitlenmektedir.",
              "Odaya girişte kapıdaki QR kodu telefonunuzla okutarak yoklama onayı vermeniz zorunludur.",
            ],
          });

          await queueSafeEmail({
            to: member.email,
            subject: `THKÜ Kütüphane - Randevunuza Son 2 Saat Kaldı (${res.room.roomNumber})`,
            body: `Sayın ${member.fullName},\n\n${roomLabel} çalışma odasındaki (${timeRangeStr}) randevunuzun başlamasına 2 saatten az süre kalmıştır.`,
            htmlBody,
            priority: 1,
          });
        }
      }
    }

    // B) Kiosk Yoklama Süresi Dolduysa Adil No-Show ve Otomatik Ban Denetimi (PostgreSQL kiosk_attendances)
    if (!res.penaltyApplied && nowEpochMins > deadlineEpochMins) {
      const checkedUserIds = await listAttendanceUserIds(createPrismaDb(prisma), res.id);
      const allApprovedUsers = [res.user, ...res.participants.map((p) => p.user)];
      const decision = buildPenaltyTargets({
        checkedUserIds,
        memberIds: allApprovedUsers.map((u) => u.id),
        status: res.status,
        minRequired: minRequiredPeople,
        penaltyApplied: res.penaltyApplied,
      });

      const verifiedUsers = allApprovedUsers.filter((u) => checkedUserIds.includes(u.id));
      const absentUsers = allApprovedUsers.filter((u) => decision.penalizeUserIds.includes(u.id));

      const roomLabel = `${res.room.roomNumber} - ${res.room.name}`;
      const dateStr = fmtDateUTC(res.reservationDate);
      const timeRangeStr = `${fmtTimeUTC(res.startTime)} - ${fmtTimeUTC(res.endTime)}`;

      if (decision.action === "cancel_no_show") {
        const queuedEmails = [];
        const bannedUsersToCleanup = [];
        const claimed = await prisma.$transaction(async (tx) => {
          const won = await claimNoShowCancellation(
            createPrismaDb(tx),
            res.id,
            `Başlangıçtan sonraki +${toleranceMinutes} dakika içinde en az ${minRequiredPeople} üye kapı QR onayı vermediği için otomatik iptal edildi.`
          );
          if (!won) return false;

          await tx.auditLog.create({
            data: {
              userId: res.user.id,
              action: "AUTO_KIOSK_CANCELLED",
              entityType: "Reservation",
              entityId: res.id,
              newData: {
                room: roomLabel,
                date: dateStr,
                time: timeRangeStr,
                progress: `${checkedUserIds.length}/${allApprovedUsers.length}`,
                reason: `+${toleranceMinutes} dk içinde en az ${minRequiredPeople} kişi kapı QR onayı vermediği için randevu otomatik iptal edildi ve oda boşa çıkarıldı.`,
              },
            },
          });

          for (const verifiedMember of verifiedUsers) {
            await tx.notification.create({
              data: {
                userId: verifiedMember.id,
                title: `Randevu İptal Edildi - Ceza Uygulanmadı (${roomLabel})`,
                message: `Kapı QR onayınız alınmıştır ancak diğer grup üyeleri +${toleranceMinutes} dk içinde onay vermediği için randevu iptal edilmiştir. Tarafınıza ceza işlenmemiştir.`,
                type: "CANCELLATION",
                relatedEntityType: "Reservation",
                relatedEntityId: res.id,
              },
            });

            const sparedHtml = buildCorporateEmailHtml({
              badgeText: "GRUP EKSİKLİĞİ İPTALİ • CEZA YOK",
              badgeColor: "#0284C7",
              badgeBg: "#E0F2FE",
              title: "Randevunuz Diğer Katılımcılar Gelmediği İçin İptal Edildi",
              greeting: `Sayın ${verifiedMember.fullName},`,
              leadText: `${escapeHtml(roomLabel)} çalışma odası için kapı QR yoklama onayınız zamanında alınmıştır. Ancak grubunuzdaki diğer katılımcılar +${toleranceMinutes} dakikalık süre içinde onay vermediği için randevu otomatik iptal edilmiştir. Kendi yoklamanızı yaptığınız için tarafınıza herhangi bir No-Show cezası İŞLENMEMİŞTİR.`,
              details: [
                { label: "Çalışma Odası", value: roomLabel },
                { label: "Tarih & Saat", value: `${dateStr} | ${timeRangeStr}` },
                { label: "Sizin Yoklama Durumunuz", value: "Kapı QR Onaylandı ✓ (Ceza Yok)" },
              ],
            });

            queuedEmails.push({
              to: verifiedMember.email,
              subject: `THKÜ Kütüphane - Randevu İptal Bilgisi / Ceza Yok (${roomLabel})`,
              body: `Sayın ${verifiedMember.fullName}, kapı QR onayınız alınmıştır ancak diğer grup üyeleri gelmediği için randevu iptal edilmiştir. Tarafınıza ceza işlenmemiştir.`,
              htmlBody: sparedHtml,
              priority: 1,
            });
          }

          for (const absentMember of absentUsers) {
            const penaltyOutcome = await persistNoShowForUser(tx, {
              member: absentMember,
              reservationId: res.id,
              roomLabel,
              dateStr,
              timeRangeStr,
              description: `${roomLabel} (${timeRangeStr}) rezervasyonunda +${toleranceMinutes} dk içinde kapı QR onayı verilmedi (Otomatik No-Show).`,
            });
            queuedEmails.push(penaltyOutcome.email);
            if (penaltyOutcome.shouldBan) {
              bannedUsersToCleanup.push(absentMember);
            }
          }

          return true;
        });

        if (!claimed) continue;

        for (const bannedMember of bannedUsersToCleanup) {
          await cancelOrRemoveBannedUserReservations({
            userId: bannedMember.id,
            userEmail: bannedMember.email,
            reasonText:
              "Kullanıcı 3. No-Show uyarısına ulaşıp banlandığı için otomatik iptal edildi.",
          });
        }

        for (const emailItem of queuedEmails) {
          await queueSafeEmail(emailItem);
        }

        const attendanceSummary = allApprovedUsers.map((u) => {
          const didCheck = checkedUserIds.includes(u.id);
          return `<strong>${escapeHtml(u.fullName)}</strong> (${escapeHtml(u.email)}) — <span style="color:${
            didCheck ? "#15803D" : "#B91C1C"
          }; font-weight:700;">${
            didCheck ? "Kapı QR Okuttu ✓ (Ceza Yok)" : "Okutmadı ✗ (No-Show Uyarısı İşlendi)"
          }</span>`;
        });

        const directorNoShowHtml = buildCorporateEmailHtml({
          badgeText: "OTOMATİK NO-SHOW İPTALİ • ODA BOŞA ÇIKTI",
          badgeColor: "#B91C1C",
          badgeBg: "#FEE2E2",
          title: `${roomLabel} Randevusu Kiosk Onayı Tamamlanmadığı İçin İptal Edildi`,
          greeting: "Sayın Kütüphane Müdürü,",
          leadText: `${escapeHtml(roomLabel)} çalışma odasının ${escapeHtml(dateStr)} (${escapeHtml(timeRangeStr)}) tarihli randevusunda +${toleranceMinutes} dakikalık yoklama süresi dolmuş olup, en az ${minRequiredPeople} katılımcı kapı QR onayı vermediği için randevu sistem tarafından otomatik iptal edilmiş ve oda diğer öğrencilerin kullanımına açılmıştır.`,
          details: [
            { label: "Çalışma Odası", value: `${roomLabel} (Tekrar Müsait Duruma Çekildi)` },
            { label: "Tarih & Saat", value: `${dateStr} | ${timeRangeStr}` },
            { label: "Kiosk Onay Durumu", value: `${checkedUserIds.length} / ${allApprovedUsers.length} Öğrenci Onayladı (Min: ${minRequiredPeople})` },
            { label: "Ceza İşlenen Üye Sayısı", value: `${absentUsers.length} Öğrenciye No-Show Uyarısı Verildi` },
          ],
          participantsTitle: "Katılımcı Yoklama ve Ceza Detayı",
          participantsList: attendanceSummary,
        });

        await queueSafeEmail({
          to: ALLOWED_DIRECTOR_EMAIL,
          subject: `[Kütüphane Müdürlüğü] Kiosk Onayı Yapılmadı - Randevu İptal Edildi: ${roomLabel} (${timeRangeStr})`,
          body: `Sayın Kütüphane Müdürü,\n\n${roomLabel} odasının ${dateStr} (${timeRangeStr}) randevusu, süresi içinde en az ${minRequiredPeople} kişi kapı QR onayı vermediği için otomatik olarak iptal edilmiş ve oda boşa çıkarılmıştır.`,
          htmlBody: directorNoShowHtml,
          priority: 1,
        });
        continue;
      } else if (decision.action === "penalize_absent") {
        const queuedEmails = [];
        const bannedUsersToCleanup = [];
        const claimed = await prisma.$transaction(async (tx) => {
          const won = await claimPenaltyApplied(createPrismaDb(tx), res.id);
          if (!won) return false;

          for (const absentMember of absentUsers) {
            const penaltyOutcome = await persistNoShowForUser(tx, {
              member: absentMember,
              reservationId: res.id,
              roomLabel,
              dateStr,
              timeRangeStr,
              description: `${roomLabel} (${timeRangeStr}) rezervasyonunda grup odayı açtı ancak üye bireysel kapı QR onayını vermedi (Otomatik No-Show).`,
            });
            queuedEmails.push(penaltyOutcome.email);
            if (penaltyOutcome.shouldBan) {
              bannedUsersToCleanup.push(absentMember);
            }
          }

          return true;
        });

        if (claimed) {
          for (const bannedMember of bannedUsersToCleanup) {
            await cancelOrRemoveBannedUserReservations({
              userId: bannedMember.id,
              userEmail: bannedMember.email,
              reasonText:
                "Kullanıcı 3. No-Show uyarısına ulaşıp banlandığı için otomatik iptal edildi.",
            });
          }
          for (const emailItem of queuedEmails) {
            await queueSafeEmail(emailItem);
          }
        }
      }
    }

    // C) Bitiş saati (endEpochMins) geçmiş olan tüm CHECKED_IN veya CONFIRMED randevuları COMPLETED durumuna geçir
    if (nowEpochMins >= endEpochMins) {
      await prisma.reservation.updateMany({
        where: { id: res.id, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        data: { status: "COMPLETED" },
      });
    }
  }
}

export async function runReservationLifecycleChecks() {
  if (globalThis.__thkuLifecyclePromise) {
    return globalThis.__thkuLifecyclePromise;
  }

  globalThis.__thkuLifecyclePromise = (async () => {
    try {
      await executeLifecycleSweep();
    } catch (error) {
      console.error("Lifecycle check error:", error);
    } finally {
      globalThis.__thkuLifecyclePromise = null;
    }
  })();

  return globalThis.__thkuLifecyclePromise;
}

if (typeof globalThis !== "undefined" && !globalThis.__thkuLifecycleTimerStarted) {
  globalThis.__thkuLifecycleTimerStarted = true;
  setInterval(() => {
    runReservationLifecycleChecks().catch(() => {});
  }, 30 * 1000);
}
