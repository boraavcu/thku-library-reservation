import prisma from "@/lib/db";
import redis from "@/lib/redis";
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
  queueSafeEmail,
  sendReservationInvitationEmails,
  handleParticipantAcceptedEmails,
  sendReservationCancelledEmails,
  sendKioskCheckInEmailToStaff,
  sendNoShowWarningEmail,
} from "@/lib/emailService";
import { applyNoShowPenaltiesForUsers } from "@/lib/penaltyService";
import { getActiveReservationRules } from "@/lib/reservationPolicy";

const INVITATION_TIMEOUT_MS = 30 * 60 * 1000;

export {
  ALLOWED_DIRECTOR_EMAIL,
  getIstanbulTimeDetails,
  getReservationKioskWindow,
  buildCorporateEmailHtml,
  queueSafeEmail,
  sendReservationInvitationEmails,
  handleParticipantAcceptedEmails,
  sendReservationCancelledEmails,
  sendKioskCheckInEmailToStaff,
  sendNoShowWarningEmail,
};

export async function runReservationLifecycleChecks() {
  if (globalThis.__thkuLifecycleRunning) return;
  globalThis.__thkuLifecycleRunning = true;

  try {
    try {
      const acquired = await redis.set("lock:thku_lifecycle", "1", "NX", "EX", 25);
      if (!acquired) return;
    } catch {
      // Redis erişilemezse yerel kilit ile devam et
    }

    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - INVITATION_TIMEOUT_MS);

    // 1. 30 DAKİKALIK DAVET ONAY SÜRESİ DOLAN PENDING RANDEVULARIN OTOMATİK İPTALİ
    const stalePendings = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: thirtyMinsAgo },
      },
      include: { room: true, user: true },
    });

    for (const stale of stalePendings) {
      const updated = await prisma.reservation.updateMany({
        where: { id: stale.id, status: "PENDING" },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason:
            "Gönderilen davetiyeler 30 dakika içinde onaylanmadığı için otomatik iptal edildi.",
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
            reason: "30 dakikalık grup davet onay süresi dolduğu için otomatik iptal edildi.",
          },
        },
      });

      const htmlBody = buildCorporateEmailHtml({
        badgeText: "SÜRE AŞIMI İPTALİ",
        badgeColor: "#B91C1C",
        badgeBg: "#FEE2E2",
        title: "Rezervasyon Talebiniz Onay Süresi Dolduğu İçin İptal Edildi",
        greeting: `Sayın ${stale.user.fullName},`,
        leadText: `${escapeHtml(roomLabel)} çalışma odası için oluşturduğunuz rezervasyon talebi, gönderilen grup davetiyeleri 30 dakika içinde onaylanmadığı için sistem tarafından otomatik olarak iptal edilmiştir.`,
        details: [
          { label: "Çalışma Odası", value: roomLabel },
          { label: "Tarih", value: fmtDateUTC(stale.reservationDate) },
          { label: "Saat Aralığı", value: timeRangeStr },
          { label: "Durum", value: "İPTAL EDİLDİ (30 Dk Onay Süresi Doldu)" },
        ],
      });

      await queueSafeEmail({
        to: stale.user.email,
        subject: "THKÜ Kütüphane - Rezervasyonunuz Onay Süresi Dolduğu İçin İptal Edildi",
        body: `Sayın ${stale.user.fullName}, ${roomLabel} odası için oluşturduğunuz rezervasyon talebi, grup davetiyeleri 30 dakika içinde onaylanmadığı için otomatik olarak iptal edilmiştir.`,
        htmlBody,
        priority: 2,
      });
    }

    // 2. KAPI QR (KİOSK) SÜRESİ, SON 2 SAAT HATIRLATMA VE SÜRESİ BİTEN RANDEVULARI COMPLETED YAPMA
    const {
      checkinToleranceMinutes: toleranceMinutes,
      minParticipants: minRequiredPeople,
    } = await getActiveReservationRules();

    const { todayDate: todayDateObj, totalMins: nowMins } = getIstanbulTimeDetails(now);
    const yesterdayDateObj = new Date(todayDateObj.getTime() - 24 * 60 * 60 * 1000);
    const nowEpochMins = Math.floor(todayDateObj.getTime() / 60000) + nowMins;

    const activeCandidates = await prisma.reservation.findMany({
      where: {
        reservationDate: { in: [yesterdayDateObj, todayDateObj] },
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

      // B) Kiosk Yoklama Süresi Dolduysa Adil No-Show ve Otomatik Ban Denetimi
      if (!res.penaltyApplied && nowEpochMins > deadlineEpochMins) {
        const checkedSetKey = `kiosk:checked_users:${res.id}`;
        const checkedUserIds = await redis.smembers(checkedSetKey);

        const allApprovedUsers = [res.user, ...res.participants.map((p) => p.user)];
        const verifiedUsers = allApprovedUsers.filter((u) => checkedUserIds.includes(u.id));
        const absentUsers = allApprovedUsers.filter((u) => !checkedUserIds.includes(u.id));

        const roomLabel = `${res.room.roomNumber} - ${res.room.name}`;
        const dateStr = fmtDateUTC(res.reservationDate);
        const timeRangeStr = `${fmtTimeUTC(res.startTime)} - ${fmtTimeUTC(res.endTime)}`;

        if (checkedUserIds.length < minRequiredPeople && res.status !== "CHECKED_IN") {
          const lockUpdate = await prisma.reservation.updateMany({
            where: { id: res.id, penaltyApplied: false },
            data: {
              status: "NO_SHOW",
              noShow: true,
              penaltyApplied: true,
              cancelledAt: now,
              cancellationReason: `Başlangıçtan sonraki +${toleranceMinutes} dakika içinde en az ${minRequiredPeople} üye kapı QR onayı vermediği için otomatik iptal edildi.`,
            },
          });

          if (lockUpdate.count === 0) continue;

          await prisma.auditLog.create({
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
            await prisma.notification.create({
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

            await queueSafeEmail({
              to: verifiedMember.email,
              subject: `THKÜ Kütüphane - Randevu İptal Bilgisi / Ceza Yok (${roomLabel})`,
              body: `Sayın ${verifiedMember.fullName}, kapı QR onayınız alınmıştır ancak diğer grup üyeleri gelmediği için randevu iptal edilmiştir. Tarafınıza ceza işlenmemiştir.`,
              htmlBody: sparedHtml,
              priority: 1,
            });
          }

          await applyNoShowPenaltiesForUsers({
            usersToPenalize: absentUsers,
            reservationId: res.id,
            roomLabel,
            dateStr,
            timeRangeStr,
            descriptionPrefix: `${roomLabel} (${timeRangeStr}) rezervasyonunda +${toleranceMinutes} dk içinde kapı QR onayı verilmedi (Otomatik No-Show).`,
            writeAuditLog: true,
          });

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
        } else if (checkedUserIds.length >= minRequiredPeople && absentUsers.length > 0) {
          const lockUpdate = await prisma.reservation.updateMany({
            where: { id: res.id, penaltyApplied: false },
            data: { penaltyApplied: true },
          });

          if (lockUpdate.count > 0) {
            await applyNoShowPenaltiesForUsers({
              usersToPenalize: absentUsers,
              reservationId: res.id,
              roomLabel,
              dateStr,
              timeRangeStr,
              descriptionPrefix: `${roomLabel} (${timeRangeStr}) rezervasyonunda grup odayı açtı ancak üye bireysel kapı QR onayını vermedi (Otomatik No-Show).`,
              writeAuditLog: true,
            });
          }
        }
      }

      // C) Bitiş saati (endEpochMins) geçmiş olan CHECKED_IN randevuları otomatik COMPLETED durumuna geçir
      if (res.status === "CHECKED_IN" && nowEpochMins >= endEpochMins) {
        await prisma.reservation.updateMany({
          where: { id: res.id, status: "CHECKED_IN" },
          data: { status: "COMPLETED" },
        });
      }
    }
  } catch (error) {
    console.error("Lifecycle check error:", error);
  } finally {
    globalThis.__thkuLifecycleRunning = false;
  }
}

if (typeof globalThis !== "undefined" && !globalThis.__thkuLifecycleTimerStarted) {
  globalThis.__thkuLifecycleTimerStarted = true;
  setInterval(() => {
    runReservationLifecycleChecks().catch(() => {});
  }, 30 * 1000);
}
