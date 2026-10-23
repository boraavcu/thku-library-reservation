import prisma from "@/lib/db";
import nodemailer from "nodemailer";

const INVITATION_TIMEOUT_MS = 30 * 60 * 1000; // Madde 10: 30 Dakika
const THKU_LOGO_URL = "https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png";

export const ALLOWED_STUDENT_EMAIL = "s250444902@stu.thk.edu.tr";
export const ALLOWED_DIRECTOR_EMAIL = "boraa-35@hotmail.com";
const SAFE_EMAIL_WHITELIST = new Set([
  ALLOWED_STUDENT_EMAIL.toLowerCase(),
  ALLOWED_DIRECTOR_EMAIL.toLowerCase(),
]);

let cachedTransporter = null;

function getSmtpTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");

  if (!smtpHost || !smtpUser || !smtpPass) return null;

  const createTransportFn =
    nodemailer.createTransport || nodemailer.default?.createTransport;

  cachedTransporter = createTransportFn.call(nodemailer, {
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
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

  return cachedTransporter;
}

/**
 * THKÜ Kurumsal Kimliğine Uygun HTML E-Posta Şablonu Üretici
 */
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
          
          <!-- Üst Kurumsal Kırmızı Şerit -->
          <tr>
            <td style="background-color: #C8102E; height: 6px; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>

          <!-- Kurumsal Lacivert Header & Logo -->
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

          <!-- İçerik Gövdesi -->
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

          <!-- Kurumsal Altbilgi (Footer) -->
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

  const transporter = getSmtpTransporter();
  const smtpUser = process.env.SMTP_USER?.trim();

  if (!transporter || !smtpUser) {
    console.warn(`⚠️ [SMTP EKSİK] .env içinde SMTP ayarları bulunamadı.`);
    return;
  }

  Promise.resolve().then(async () => {
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
  });
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
  try {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - INVITATION_TIMEOUT_MS);

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
          { label: "Saat Aralığı", value: `${fmtTimeUTC(stale.startTime)} - ${fmtTimeUTC(stale.endTime)}` },
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

    const todayTrStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const todayDateObj = new Date(`${todayTrStr}T00:00:00Z`);

    const timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const curH = Number(timeParts.find((p) => p.type === "hour").value);
    const curM = Number(timeParts.find((p) => p.type === "minute").value);
    const nowMins = curH * 60 + curM;

    const todayConfirmed = await prisma.reservation.findMany({
      where: {
        reservationDate: todayDateObj,
        status: "CONFIRMED",
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

    for (const res of todayConfirmed) {
      const startH = new Date(res.startTime).getUTCHours();
      const startM = new Date(res.startTime).getUTCMinutes();
      const startMins = startH * 60 + startM;
      const diffMins = startMins - nowMins;

      if (diffMins > 0 && diffMins <= 120) {
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
    }
  } catch (error) {
    console.error("Lifecycle check error:", error);
  }
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
      // 1) Kütüphane Müdürüne Kurumsal HTML Bildirim Maili
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

      // 2) Organizatöre ve Onaylayan 2. Kişiye Kurumsal HTML Onay Maili
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

    // 3., 4., 5. Kişi Kabul Ettiğinde Sadece O Kişiye Giden Kurumsal HTML Mail
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
        "3 kez No-Show uyarısı alan kullanıcıların hesapları 30 gün veya dönem boyunca rezervasyonlara kapatılır.",
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