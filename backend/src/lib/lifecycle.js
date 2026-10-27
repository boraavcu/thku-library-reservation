import prisma from "@/lib/db";
import redis from "@/lib/redis";
import nodemailer from "nodemailer";

const INVITATION_TIMEOUT_MS = 30 * 60 * 1000; // Madde 10: 30 Dakika
const DEFAULT_TOLERANCE_MINUTES = 15;
const DEFAULT_MIN_PARTICIPANTS = 2;
const THKU_LOGO_URL = "https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png";

export const ALLOWED_STUDENT_EMAIL = "s250444902@stu.thk.edu.tr";
export const ALLOWED_DIRECTOR_EMAIL = process.env.DIRECTOR_EMAIL || "boraa-35@hotmail.com";
const SAFE_EMAIL_WHITELIST = new Set([
  ALLOWED_STUDENT_EMAIL.toLowerCase(),
  ALLOWED_DIRECTOR_EMAIL.toLowerCase(),
]);

function createFreshTransporter() {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  const createTransportFn =
    nodemailer.createTransport || nodemailer.default?.createTransport;

  return createTransportFn.call(nodemailer, {
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function getIstanbulTimeDetails(dateInput = new Date()) {
  const d = new Date(dateInput);
  const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const hour = Number(timeParts.find((p) => p.type === "hour").value);
  const minute = Number(timeParts.find((p) => p.type === "minute").value);
  return { dateStr, hour, minute, totalMins: hour * 60 + minute };
}

/**
 * Randevu saat 16:00'dan ÖNCE alındıysa (veya seed.cjs ile oluşturulduysa):
 *   Onay penceresi kesin olarak 15:45 – 16:15 (startTotalMins ± toleranceMinutes) arasındadır.
 * Randevu saat 16:00'dan SONRA (oda boşa düştükten sonra, örn: 16:20'de) sıfırdan oluşturulduysa:
 *   Yeni grubun hemen odaya girerken QR okutabilmesi için oluşturulma anından itibaren +15 dk (16:20 – 16:35) verilir.
 *   (updatedAt / davet onay saati süreyi asla uzatmaz!)
 */
export function getReservationKioskWindow(reservation, todayTrStr, toleranceMinutes = 15) {
  const sH = new Date(reservation.startTime).getUTCHours();
  const sM = new Date(reservation.startTime).getUTCMinutes();
  const startTotalMins = sH * 60 + sM;

  if (reservation.createdAt) {
    const createdInfo = getIstanbulTimeDetails(reservation.createdAt);
    if (createdInfo.dateStr === todayTrStr && createdInfo.totalMins > startTotalMins) {
      return {
        startTotalMins,
        minAllowed: createdInfo.totalMins,
        maxAllowed: createdInfo.totalMins + toleranceMinutes,
      };
    }
  }

  return {
    startTotalMins,
    minAllowed: startTotalMins - toleranceMinutes,
    maxAllowed: startTotalMins + toleranceMinutes,
  };
}

function buildCorporateEmailHtml({
  badgeText = "BİLGİLENDİRME",
  badgeColor = "#1D4ED8",
  badgeBg = "#DBEAFE",
  title,
  greeting,
  leadText,
  details = [],
  participantsTitle = null,
  participantsList = [],
  rulesTitle = null,
  rulesList = [],
  footerNote = "Bu e-posta Türk Hava Kurumu Üniversitesi Kütüphane Oda Rezervasyon Sistemi tarafından otomatik olarak oluşturulmuştur.",
}) {
  const detailsRowsHtml = details
    .map(
      (d) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 13px; font-weight: 600; width: 38%;">
          ${d.label}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; color: #0F172A; font-size: 14px; font-weight: 700;">
          ${d.value}
        </td>
      </tr>`
    )
    .join("");

  const participantsHtml =
    participantsList.length > 0
      ? `
      <div style="margin-top: 22px;">
        <div style="font-size: 13px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;">
          ${participantsTitle || "Katılımcı Listesi"}
        </div>
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px;">
          ${participantsList
            .map(
              (p, i) => `
            <div style="padding: 6px 0; ${
              i < participantsList.length - 1 ? "border-bottom: 1px dashed #E2E8F0;" : ""
            } font-size: 13px; color: #334155;">
              <strong style="color: #0F172A;">${i + 1}.</strong> ${p}
            </div>`
            )
            .join("")}
        </div>
      </div>`
      : "";

  const rulesHtml =
    rulesList.length > 0
      ? `
      <div style="margin-top: 22px; background-color: #FFFBEB; border-left: 4px solid #F59E0B; border-radius: 6px; padding: 14px 16px;">
        <div style="font-size: 13px; font-weight: 700; color: #92400E; margin-bottom: 6px;">
          ${rulesTitle || "Önemli Hatırlatmalar"}
        </div>
        <ul style="margin: 0; padding-left: 18px; color: #78350F; font-size: 13px; line-height: 1.6;">
          ${rulesList.map((r) => `<li style="margin-bottom: 4px;">${r}</li>`).join("")}
        </ul>
      </div>`
      : "";

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F1F5F9; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0;">
          <tr>
            <td style="background-color: #C8102E; height: 6px; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color: #0F172A; padding: 24px 28px; text-align: center;">
              <img src="${THKU_LOGO_URL}" alt="THKÜ Logo" width="68" height="68" style="background-color: #FFFFFF; padding: 6px; border-radius: 50%; display: block; margin: 0 auto 12px auto; object-fit: contain;" />
              <div style="color: #FFFFFF; font-size: 17px; font-weight: 800; letter-spacing: 0.03em;">
                TÜRK HAVA KURUMU ÜNİVERSİTESİ
              </div>
              <div style="color: #94A3B8; font-size: 12px; font-weight: 600; margin-top: 4px;">
                Kütüphane ve Dokümantasyon Daire Başkanlığı • Grup Çalışma Odaları Sistemi
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 30px;">
              <div style="margin-bottom: 14px;">
                <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 999px; letter-spacing: 0.05em; text-transform: uppercase;">
                  ${badgeText}
                </span>
              </div>
              <h2 style="margin: 0 0 14px 0; color: #0F172A; font-size: 20px; font-weight: 800; line-height: 1.3;">
                ${title}
              </h2>
              <p style="margin: 0 0 12px 0; color: #1E293B; font-size: 14px; font-weight: 600;">
                ${greeting}
              </p>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                ${leadText}
              </p>
              ${
                details.length > 0
                  ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background-color: #FFFFFF;">
                ${detailsRowsHtml}
              </table>`
                  : ""
              }
              ${participantsHtml}
              ${rulesHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 18px 30px; text-align: center;">
              <div style="color: #64748B; font-size: 12px; line-height: 1.5;">
                ${footerNote}
              </div>
              <div style="color: #94A3B8; font-size: 11px; margin-top: 6px; font-weight: 600;">
                © ${new Date().getFullYear()} Türk Hava Kurumu Üniversitesi • Türkkuşu Kampüsü, Etimesgut / Ankara
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function queueSafeEmail({ to, subject, body, htmlBody = null, priority = 2 }) {
  if (!to) return;
  const normalizedTo = to.trim().toLowerCase();

  if (!SAFE_EMAIL_WHITELIST.has(normalizedTo)) {
    return;
  }

  const queued = await prisma.emailQueue.create({
    data: {
      to: normalizedTo,
      subject,
      body,
      htmlBody,
      priority,
      status: "PENDING",
    },
  });

  const transporter = createFreshTransporter();
  const smtpUser = process.env.SMTP_USER?.trim();

  if (!transporter || !smtpUser) {
    console.warn(`⚠️ [SMTP EKSİK] .env içinde SMTP ayarları bulunamadı.`);
    return;
  }

  console.log(`📧 [E-POSTA GÖNDERİLİYOR] Alıcı: ${normalizedTo} | Konu: ${subject}`);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"THKÜ Kütüphane Sistemi" <${smtpUser}>`,
      to: normalizedTo,
      subject,
      text: body,
      ...(htmlBody && { html: htmlBody }),
    });

    await prisma.emailQueue.update({
      where: { id: queued.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    console.log(`✅ [KURUMSAL E-POSTA İLETİLDİ] -> ${normalizedTo} | Konu: ${subject}`);
  } catch (smtpErr) {
    console.error(`❌ [SMTP GÖNDERİM HATASI] (${normalizedTo}):`, smtpErr.message);
    try {
      await prisma.emailQueue.update({
        where: { id: queued.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: smtpErr.message,
          attempts: { increment: 1 },
        },
      });
    } catch (dbErr) {
      console.error("EmailQueue update error:", dbErr.message);
    }
  }
}

function fmtTimeUTC(dt) {
  const d = new Date(dt);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === 23 && m >= 59) return "24:00";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtDateUTC(dt) {
  return new Date(dt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function runReservationLifecycleChecks() {
  if (globalThis.__thkuLifecycleRunning) return;
  globalThis.__thkuLifecycleRunning = true;

  try {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - INVITATION_TIMEOUT_MS);

    // 1. 30 DAKİKALIK DAVET ONAY SÜRESİ DOLAN PENDING RANDEVULARIN OTOMATİK İPTALİ
    const stalePendings = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: thirtyMinsAgo },
      },
      include: {
        room: true,
        user: true,
      },
    });

    for (const stale of stalePendings) {
      await prisma.reservation.update({
        where: { id: stale.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancellationReason: "Gönderilen davetiyeler 30 dakika içinde onaylanmadığı için otomatik iptal edildi.",
        },
      });

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
        leadText: `${roomLabel} çalışma odası için oluşturduğunuz rezervasyon talebi, gönderilen grup davetiyeleri 30 dakika içinde onaylanmadığı için sistem tarafından otomatik olarak iptal edilmiştir.`,
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

    // Dinamik Kuralları Oku (CHECKIN_TOLERANCE_MINUTES ve MIN_PARTICIPANTS)
    const rulesRows = await prisma.reservationRule.findMany({
      where: {
        isActive: true,
        ruleName: { in: ["CHECKIN_TOLERANCE_MINUTES", "MIN_PARTICIPANTS"] },
      },
      select: { ruleName: true, ruleValue: true },
    });
    const rulesMap = Object.fromEntries(rulesRows.map((r) => [r.ruleName, r.ruleValue?.value]));
    const toleranceMinutes = Number(rulesMap.CHECKIN_TOLERANCE_MINUTES ?? DEFAULT_TOLERANCE_MINUTES);
    const minRequiredPeople = Math.max(2, Number(rulesMap.MIN_PARTICIPANTS ?? DEFAULT_MIN_PARTICIPANTS));

    const { dateStr: todayTrStr, totalMins: nowMins } = getIstanbulTimeDetails(now);
    const todayDateObj = new Date(`${todayTrStr}T00:00:00Z`);

    // 2. KAPI QR (KİOSK) SÜRESİ (BAŞLANGIÇ + 15 DK) DOLAN RANDEVULARIN OTOMATİK İPTALİ, CEZASI VE LOGLANMASI
    const activeTodayList = await prisma.reservation.findMany({
      where: {
        reservationDate: todayDateObj,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        penaltyApplied: false,
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

    for (const res of activeTodayList) {
      const sH = new Date(res.startTime).getUTCHours();
      const sM = new Date(res.startTime).getUTCMinutes();

      const { startTotalMins, maxAllowed: deadlineMins } = getReservationKioskWindow(
        res,
        todayTrStr,
        toleranceMinutes
      );
      const diffMins = startTotalMins - nowMins;

      // A) Başlangıca 2 saat (120 dk) kala hatırlatma maili
      if (res.status === "CONFIRMED" && diffMins > 0 && diffMins <= 120) {
        const alreadySent = await prisma.notification.findFirst({
          where: {
            relatedEntityId: res.id,
            type: "RESERVATION_REMINDER",
          },
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
              leadText: `${roomLabel} çalışma odasındaki grup randevunuzun başlamasına 2 saatten az süre kalmıştır.`,
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

      // B) Kiosk Yoklama Süresi (Örn: 16:00 + 15 dk = 16:15) Geçtiyse Otomatik Denetim!
      if (nowMins > deadlineMins) {
        const checkedSetKey = `kiosk:checked_users:${res.id}`;
        const checkedUserIds = await redis.smembers(checkedSetKey);

        const allApprovedUsers = [res.user, ...res.participants.map((p) => p.user)];
        const verifiedUsers = allApprovedUsers.filter((u) => checkedUserIds.includes(u.id));
        const absentUsers = allApprovedUsers.filter((u) => !checkedUserIds.includes(u.id));

        const roomLabel = `${res.room.roomNumber} - ${res.room.name}`;
        const dateStr = fmtDateUTC(res.reservationDate);
        const timeRangeStr = `${fmtTimeUTC(res.startTime)} - ${fmtTimeUTC(res.endTime)}`;

        // DURUM 1: En az 2 kişi (minRequiredPeople) Kiosk onayı VERMEDİ -> Randevu NO_SHOW olur ve oda boşa çıkar!
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
              leadText: `${roomLabel} çalışma odası için kapı QR yoklama onayınız zamanında alınmıştır. Ancak grubunuzdaki diğer katılımcılar +${toleranceMinutes} dakikalık süre içinde onay vermediği için (minimum ${minRequiredPeople} kişi şartı sağlanamadığından) randevu otomatik iptal edilmiştir. Kendi yoklamanızı yaptığınız için tarafınıza herhangi bir No-Show cezası İŞLENMEMİŞTİR.`,
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

          for (const absentMember of absentUsers) {
            await prisma.penaltyHistory.create({
              data: {
                userId: absentMember.id,
                reservationId: res.id,
                penaltyType: "NO_SHOW",
                penaltyPoints: 15,
                description: `${roomLabel} (${timeRangeStr}) rezervasyonunda +${toleranceMinutes} dk içinde kapı QR onayı verilmedi (Otomatik No-Show).`,
              },
            });

            const activeNoShowCount = await prisma.penaltyHistory.count({
              where: {
                userId: absentMember.id,
                penaltyType: "NO_SHOW",
                isActive: true,
              },
            });

            const shouldBan = activeNoShowCount >= 3;
            const banUntilDate = shouldBan
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : undefined;

            await prisma.user.update({
              where: { id: absentMember.id },
              data: {
                penaltyPoints: { increment: 15 },
                ...(shouldBan && {
                  isBanned: true,
                  banUntil: banUntilDate,
                  banReason: `Dönem içinde 3 kez No-Show (Kapı QR onayı vermeme) ihlali nedeniyle 30 gün otomatik banlandı.`,
                }),
              },
            });

            await prisma.auditLog.create({
              data: {
                userId: absentMember.id,
                action: shouldBan ? "AUTO_NO_SHOW_BANNED" : "AUTO_NO_SHOW_PENALTY",
                entityType: "Reservation",
                entityId: res.id,
                newData: {
                  room: roomLabel,
                  date: dateStr,
                  time: timeRangeStr,
                  student: `${absentMember.fullName} (${absentMember.email})`,
                  warningCount: `${activeNoShowCount}/3`,
                  banUntil: shouldBan && banUntilDate ? banUntilDate.toLocaleDateString("tr-TR") : null,
                },
              },
            });

            await sendNoShowWarningEmail({
              user: absentMember,
              activeNoShowCount,
              roomLabel,
              dateStr,
              isBanned: shouldBan,
              banUntilDate,
            });

            if (shouldBan) {
              await prisma.reservation.updateMany({
                where: {
                  userId: absentMember.id,
                  status: { in: ["PENDING", "CONFIRMED"] },
                  reservationDate: { gte: todayDateObj },
                },
                data: {
                  status: "CANCELLED",
                  cancelledAt: now,
                  cancellationReason: "Kullanıcı 3. No-Show uyarısına ulaşıp banlandığı için otomatik iptal edildi.",
                },
              });
            }
          }

          const attendanceSummary = allApprovedUsers.map((u) => {
            const didCheck = checkedUserIds.includes(u.id);
            return `<strong>${u.fullName}</strong> (${u.email}) — <span style="color:${
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
            leadText: `${roomLabel} çalışma odasının ${dateStr} (${timeRangeStr}) tarihli randevusunda +${toleranceMinutes} dakikalık yoklama süresi dolmuş olup, en az ${minRequiredPeople} katılımcı kapı QR onayı vermediği için randevu sistem tarafından otomatik iptal edilmiş ve oda diğer öğrencilerin kullanımına açılmıştır.`,
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
        } else if (checkedUserIds.length >= minRequiredPeople && absentUsers.length > 0) {
          // DURUM 2: En az 2 kişi onayladı (Oda CHECKED_IN), ancak grupta QR okutmayan 3./4. üyeler var!
          const lockUpdate = await prisma.reservation.updateMany({
            where: { id: res.id, penaltyApplied: false },
            data: { penaltyApplied: true },
          });

          if (lockUpdate.count === 0) continue;

          for (const absentMember of absentUsers) {
            await prisma.penaltyHistory.create({
              data: {
                userId: absentMember.id,
                reservationId: res.id,
                penaltyType: "NO_SHOW",
                penaltyPoints: 15,
                description: `${roomLabel} (${timeRangeStr}) rezervasyonunda grup odayı açtı ancak üye bireysel kapı QR onayını vermedi (Otomatik No-Show).`,
              },
            });

            const activeNoShowCount = await prisma.penaltyHistory.count({
              where: {
                userId: absentMember.id,
                penaltyType: "NO_SHOW",
                isActive: true,
              },
            });

            const shouldBan = activeNoShowCount >= 3;
            const banUntilDate = shouldBan
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : undefined;

            await prisma.user.update({
              where: { id: absentMember.id },
              data: {
                penaltyPoints: { increment: 15 },
                ...(shouldBan && {
                  isBanned: true,
                  banUntil: banUntilDate,
                  banReason: `Dönem içinde 3 kez No-Show (Kapı QR onayı vermeme) ihlali nedeniyle 30 gün otomatik banlandı.`,
                }),
              },
            });

            await prisma.auditLog.create({
              data: {
                userId: absentMember.id,
                action: shouldBan ? "AUTO_NO_SHOW_BANNED" : "AUTO_NO_SHOW_PENALTY",
                entityType: "Reservation",
                entityId: res.id,
                newData: {
                  room: roomLabel,
                  date: dateStr,
                  time: timeRangeStr,
                  student: `${absentMember.fullName} (${absentMember.email})`,
                  warningCount: `${activeNoShowCount}/3`,
                  banUntil: shouldBan && banUntilDate ? banUntilDate.toLocaleDateString("tr-TR") : null,
                },
              },
            });

            await sendNoShowWarningEmail({
              user: absentMember,
              activeNoShowCount,
              roomLabel,
              dateStr,
              isBanned: shouldBan,
              banUntilDate,
            });
          }
        }
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

export async function handleParticipantAcceptedEmails({
  reservationId,
  acceptingUserId,
  isInitialConfirmation,
}) {
  try {
    const res = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        room: true,
        user: true,
        participants: {
          where: { status: { not: "REJECTED" } },
          include: { user: true },
        },
      },
    });

    if (!res) return;

    const dateStr = fmtDateUTC(res.reservationDate);
    const timeStr = `${fmtTimeUTC(res.startTime)} - ${fmtTimeUTC(res.endTime)}`;
    const roomLabel = `${res.room.roomNumber} - ${res.room.name}`;

    const acceptedParticipants = res.participants.filter((p) => p.status === "ACCEPTED");
    const acceptingParticipant = acceptedParticipants.find((p) => p.userId === acceptingUserId)?.user;

    const allGroupPeople = [
      { fullName: res.user.fullName, email: res.user.email, statusLabel: "Organizatör (Onaylı)" },
      ...res.participants.map((p) => ({
        fullName: p.user.fullName,
        email: p.user.email,
        statusLabel: p.status === "ACCEPTED" ? "Katılımcı (Onayladı ✓)" : "Katılımcı (Onay Bekliyor)",
      })),
    ];

    const formattedParticipants = allGroupPeople.map(
      (m) => `<strong>${m.fullName}</strong> (${m.email}) — <span style="color:#0284C7;">${m.statusLabel}</span>`
    );

    if (isInitialConfirmation) {
      const directorHtml = buildCorporateEmailHtml({
        badgeText: "ODA AYRILDI (CONFIRMED)",
        badgeColor: "#15803D",
        badgeBg: "#DCFCE7",
        title: `${roomLabel} Çalışma Odası Rezerve Edildi`,
        greeting: "Sayın Kütüphane Müdürü,",
        leadText: `Aşağıda bilgileri yer alan çalışma odası, en az 2 kişilik grup onay şartını tamamlayarak resmen ayrılmıştır.`,
        details: [
          { label: "Ayrılan Oda", value: roomLabel },
          { label: "Tarih", value: dateStr },
          { label: "Saat Aralığı", value: timeStr },
          { label: "Grup Büyüklüğü", value: `Toplam ${allGroupPeople.length} Kişi (${1 + acceptedParticipants.length} Onaylı)` },
          { label: "Çalışma Amacı", value: res.purpose || "Grup Çalışması" },
        ],
        participantsTitle: "Odayı Ayıran Öğrenciler",
        participantsList: formattedParticipants,
      });

      await queueSafeEmail({
        to: ALLOWED_DIRECTOR_EMAIL,
        subject: `[Kütüphane Müdürlüğü] Oda Ayrıldı: ${roomLabel} (${dateStr} | ${timeStr})`,
        body: `Sayın Kütüphane Müdürü,\n\n${roomLabel} çalışma odası (${dateStr} | ${timeStr}) en az 2 kişi onay şartını tamamlayarak ayrılmıştır.`,
        htmlBody: directorHtml,
        priority: 1,
      });

      const recipientsForInitial = [res.user];
      if (acceptingParticipant && acceptingParticipant.id !== res.user.id) {
        recipientsForInitial.push(acceptingParticipant);
      }

      for (const member of recipientsForInitial) {
        await prisma.notification.create({
          data: {
            userId: member.id,
            title: `Randevunuz Onaylandı (${roomLabel})`,
            message: `${dateStr} (${timeStr}) tarihli çalışma odası randevunuz onaylanmıştır.`,
            type: "SYSTEM",
            relatedEntityType: "Reservation",
            relatedEntityId: res.id,
          },
        });

        const studentHtml = buildCorporateEmailHtml({
          badgeText: "REZERVASYON ONAYLANDI",
          badgeColor: "#15803D",
          badgeBg: "#DCFCE7",
          title: "Çalışma Odası Rezervasyonunuz Onaylandı",
          greeting: `Sayın ${member.fullName},`,
          leadText: `${roomLabel} çalışma odası için oluşturulan grup rezervasyonunuz yeterli katılımcı onayına ulaşarak kesinleşmiştir.`,
          details: [
            { label: "Çalışma Odası", value: roomLabel },
            { label: "Tarih", value: dateStr },
            { label: "Saat Aralığı", value: timeStr },
            { label: "Çalışma Amacı", value: res.purpose || "Grup Çalışması" },
          ],
          participantsTitle: "Grup Katılımcıları",
          participantsList: formattedParticipants,
          rulesTitle: "Kullanım ve Yoklama Kuralları",
          rulesList: [
            "Randevu başlangıç saatine 1 saat kala iptal işlemi kapanmaktadır.",
            "Randevu başlangıç saatinde oda girişindeki QR kodu kendi mobil cihazınızla okutarak onay vermeniz zorunludur.",
            "Randevusuna gelmeyen (No-Show) kullanıcılara uyarı uygulanır; 3 uyarı sonunda hesap rezervasyonlara kapatılır.",
          ],
        });

        await queueSafeEmail({
          to: member.email,
          subject: `THKÜ Kütüphane - Randevunuz Onaylandı (${roomLabel})`,
          body: `Sayın ${member.fullName},\n\n${roomLabel} çalışma odası için ${dateStr} (${timeStr}) tarihli grup randevunuz onaylanmıştır.`,
          htmlBody: studentHtml,
          priority: 1,
        });
      }
      return;
    }

    if (acceptingParticipant) {
      await prisma.notification.create({
        data: {
          userId: acceptingParticipant.id,
          title: `Gruba Katılımınız Onaylandı (${roomLabel})`,
          message: `${dateStr} (${timeStr}) tarihli ${roomLabel} çalışma odası randevusuna katılımınız onaylanmıştır.`,
          type: "SYSTEM",
          relatedEntityType: "Reservation",
          relatedEntityId: res.id,
        },
      });

      const thirdPersonHtml = buildCorporateEmailHtml({
        badgeText: "GRUBA KATILIM ONAYLANDI",
        badgeColor: "#1D4ED8",
        badgeBg: "#DBEAFE",
        title: "Çalışma Grubu Katılımınız Kaydedildi",
        greeting: `Sayın ${acceptingParticipant.fullName},`,
        leadText: `${roomLabel} çalışma odasındaki onaylı grup randevusuna katılımınız başarıyla kaydedilmiştir.`,
        details: [
          { label: "Çalışma Odası", value: roomLabel },
          { label: "Tarih", value: dateStr },
          { label: "Saat Aralığı", value: timeStr },
          { label: "Çalışma Amacı", value: res.purpose || "Grup Çalışması" },
        ],
        rulesTitle: "Yoklama Hatırlatması",
        rulesList: [
          "Randevu saatinde oda girişindeki QR kodu kendi telefonunuzla okutarak yoklama onayı vermeniz zorunludur.",
        ],
      });

      await queueSafeEmail({
        to: acceptingParticipant.email,
        subject: `THKÜ Kütüphane - Randevu Katılımınız Onaylandı (${roomLabel})`,
        body: `Sayın ${acceptingParticipant.fullName},\n\n${roomLabel} çalışma odasındaki ${dateStr} (${timeStr}) tarihli onaylı grup randevusuna katılımınız kaydedilmiştir.`,
        htmlBody: thirdPersonHtml,
        priority: 1,
      });
    }
  } catch (error) {
    console.error("Participant accepted email dispatch error:", error);
  }
}

export async function sendReservationCancelledEmails({
  reservationId,
  cancelledByEmail,
  reason,
  wasConfirmed,
}) {
  try {
    const res = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        room: true,
        user: true,
        participants: {
          where: { status: { not: "REJECTED" } },
          include: { user: true },
        },
      },
    });

    if (!res) return;

    const dateStr = fmtDateUTC(res.reservationDate);
    const timeStr = `${fmtTimeUTC(res.startTime)} - ${fmtTimeUTC(res.endTime)}`;
    const roomLabel = `${res.room.roomNumber} - ${res.room.name}`;

    const allMembers = [
      res.user,
      ...res.participants.map((p) => p.user),
    ];

    const formattedParticipants = allMembers.map(
      (m) => `<strong>${m.fullName}</strong> (${m.email})`
    );

    if (wasConfirmed) {
      const directorCancelHtml = buildCorporateEmailHtml({
        badgeText: "ONAYLI RANDEVU İPTAL EDİLDİ",
        badgeColor: "#B91C1C",
        badgeBg: "#FEE2E2",
        title: `${roomLabel} Onaylı Oda Randevusu İptal Edildi`,
        greeting: "Sayın Kütüphane Müdürü,",
        leadText: `Daha önce onaylanmış (CONFIRMED) olan aşağıdaki çalışma odası randevusu iptal edilmiş olup, oda ilgili saat dilimi için tekrar boşa çıkarılmıştır.`,
        details: [
          { label: "Çalışma Odası", value: roomLabel },
          { label: "Tarih", value: dateStr },
          { label: "Saat Aralığı", value: timeStr },
          { label: "İptal Eden", value: cancelledByEmail },
          { label: "İptal Sebebi", value: reason || "Kullanıcı / Görevli İptali" },
        ],
        participantsTitle: "İptal Edilen Grup Üyeleri",
        participantsList: formattedParticipants,
      });

      await queueSafeEmail({
        to: ALLOWED_DIRECTOR_EMAIL,
        subject: `[Kütüphane Müdürlüğü] Onaylı Randevu İptal Edildi: ${roomLabel} (${dateStr} | ${timeStr})`,
        body: `Sayın Kütüphane Müdürü,\n\n${roomLabel} odasının ${dateStr} (${timeStr}) tarihli onaylı randevusu (${cancelledByEmail} tarafından) iptal edilmiştir.`,
        htmlBody: directorCancelHtml,
        priority: 1,
      });
    }

    for (const member of allMembers) {
      await prisma.notification.create({
        data: {
          userId: member.id,
          title: `Rezervasyon İptal Edildi (${roomLabel})`,
          message: `${dateStr} (${timeStr}) tarihli ${roomLabel} çalışma odası rezervasyonunuz iptal edilmiştir.`,
          type: "CANCELLATION",
          relatedEntityType: "Reservation",
          relatedEntityId: res.id,
        },
      });

      const studentCancelHtml = buildCorporateEmailHtml({
        badgeText: "REZERVASYON İPTAL EDİLDİ",
        badgeColor: "#B91C1C",
        badgeBg: "#FEE2E2",
        title: "Çalışma Odası Rezervasyonunuz İptal Edilmiştir",
        greeting: `Sayın ${member.fullName},`,
        leadText: `Aşağıda bilgileri yer alan grup çalışma odası rezervasyonunuz iptal edilmiş olup, günlük rezervasyon kotanız tekrar serbest bırakılmıştır.`,
        details: [
          { label: "Çalışma Odası", value: roomLabel },
          { label: "Tarih", value: dateStr },
          { label: "Saat Aralığı", value: timeStr },
          { label: "İptal Sebebi", value: reason || "Organizatör / Görevli İptali" },
        ],
      });

      await queueSafeEmail({
        to: member.email,
        subject: `THKÜ Kütüphane - Rezervasyonunuz İptal Edilmiştir (${roomLabel})`,
        body: `Sayın ${member.fullName},\n\n${dateStr} (${timeStr}) tarihli ${roomLabel} çalışma odası rezervasyonunuz iptal edilmiştir.`,
        htmlBody: studentCancelHtml,
        priority: 1,
      });
    }
  } catch (error) {
    console.error("Cancel email dispatch error:", error);
  }
}

export async function sendKioskCheckInEmailToStaff(reservationId, checkedUserIds = []) {
  try {
    const res = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        room: true,
        user: true,
        participants: {
          where: { status: "ACCEPTED" },
          include: { user: true },
        },
      },
    });

    if (!res) return;

    const dateStr = fmtDateUTC(res.reservationDate);
    const timeStr = `${fmtTimeUTC(res.startTime)} - ${fmtTimeUTC(res.endTime)}`;
    const roomLabel = `${res.room.roomNumber} - ${res.room.name}`;
    const allMembers = [res.user, ...res.participants.map((p) => p.user)];

    const formattedCheckInList = allMembers.map((m) => {
      const hasVerified = checkedUserIds.includes(m.id);
      return `<strong>${m.fullName}</strong> (${m.email}) — <span style="color:${
        hasVerified ? "#15803D" : "#D97706"
      }; font-weight:700;">${hasVerified ? "Kapı QR Onayladı ✓" : "Bekleniyor..."}</span>`;
    });

    const htmlBody = buildCorporateEmailHtml({
      badgeText: "RANDEVU BAŞLADI • KİOSK ONAYLANDI",
      badgeColor: "#15803D",
      badgeBg: "#DCFCE7",
      title: `${roomLabel} Odası Kullanıma Açıldı`,
      greeting: "Sayın Kütüphane Müdürü,",
      leadText: `${roomLabel} çalışma odasındaki randevu için Kapı QR kodu en az 2 grup üyesi tarafından onaylanmış ve oda kullanımı resmen başlamıştır.`,
      details: [
        { label: "Çalışma Odası", value: roomLabel },
        { label: "Tarih & Saat", value: `${dateStr} | ${timeStr}` },
        { label: "Kiosk Yoklama Durumu", value: `${checkedUserIds.length} / ${allMembers.length} Öğrenci Onayladı` },
        { label: "Çalışma Amacı", value: res.purpose || "Grup Çalışması" },
      ],
      participantsTitle: "Katılımcı Yoklama Listesi",
      participantsList: formattedCheckInList,
    });

    await queueSafeEmail({
      to: ALLOWED_DIRECTOR_EMAIL,
      subject: `[Randevu Başladı - Kiosk Onaylandı] ${roomLabel} (${timeStr})`,
      body: `Sayın Kütüphane Müdürü,\n\n${roomLabel} çalışma odasındaki randevu için Kapı QR kodu en az 2 grup üyesi tarafından onaylanmış ve randevu resmen BAŞLAMIŞTIR.`,
      htmlBody,
      priority: 1,
    });
  } catch (error) {
    console.error("Staff check-in email error:", error);
  }
}

export async function sendNoShowWarningEmail({
  user,
  activeNoShowCount,
  roomLabel,
  dateStr,
  isBanned,
  banUntilDate,
}) {
  try {
    const remainingRights = Math.max(0, 3 - activeNoShowCount);
    const banUntilFormatted = banUntilDate
      ? new Date(banUntilDate).toLocaleDateString("tr-TR")
      : "Kalıcı (Süresiz)";

    const subject = isBanned
      ? `THKÜ Kütüphane - 3/3 Uyarı Sonucu Rezervasyon Yasağı (Ban) Bildirimi`
      : `THKÜ Kütüphane - Rezervasyon Gelmeme (No-Show) Uyarısı (${activeNoShowCount}/3)`;

    const body = isBanned
      ? `Sayın ${user.fullName},\n\n${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gelmediğiniz tespit edilmiştir. 3/3 uyarı hakkınızı doldurduğunuz için hesabınız ${banUntilFormatted} tarihine kadar rezervasyonlara kapatılmıştır.`
      : `Sayın ${user.fullName},\n\n${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gitmediğiniz tespit edilmiştir. Mevcut Uyarı: ${activeNoShowCount}/3, Kalan Hak: ${remainingRights}.`;

    const htmlBody = buildCorporateEmailHtml({
      badgeText: isBanned ? "HESAP ASKIYA ALINDI (3/3)" : `NO-SHOW UYARISI (${activeNoShowCount}/3)`,
      badgeColor: "#B91C1C",
      badgeBg: "#FEE2E2",
      title: isBanned
        ? "Çalışma Odası Rezervasyon Yetkiniz Askıya Alındı"
        : "Rezervasyona Gelmeme (No-Show) Uyarısı",
      greeting: `Sayın ${user.fullName},`,
      leadText: isBanned
        ? `${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gelmediğiniz (Kapı QR onayı vermediğiniz) tespit edilmiştir. Dönem içindeki 3/3 uyarı hakkınızı doldurduğunuz için hesabınız rezervasyonlara kapatılmıştır.`
        : `${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gelmediğiniz (Kapı QR onayı vermediğiniz) tespit edilmiştir.`,
      details: [
        { label: "İlgili Oda", value: roomLabel },
        { label: "Rezervasyon Tarihi", value: dateStr },
        { label: "Mevcut Uyarı Sayınız", value: `${activeNoShowCount} / 3` },
        {
          label: isBanned ? "Yasak Bitiş Tarihi" : "Kalan Uyarı Hakkınız",
          value: isBanned ? banUntilFormatted : `${remainingRights} Hak`,
        },
      ],
      rulesTitle: "Disiplin ve Ceza Politikası",
      rulesList: [
        "Onaylanan randevulara başlangıç saatinde kapı QR kodu okutularak giriş yapılması zorunludur.",
        "3 kez No-Show uyarısı alan kullanıcıların hesapları 30 gün boyunca rezervasyonlara kapatılır.",
      ],
    });

    await queueSafeEmail({
      to: user.email,
      subject,
      body,
      htmlBody,
      priority: 1,
    });

    await prisma.notification.create({
      data: {
        userId: user.id,
        title: subject,
        message: body,
        type: isBanned ? "BAN_WARNING" : "PENALTY",
      },
    });
  } catch (error) {
    console.error("No-show warning email error:", error);
  }
}