import prisma from "@/lib/db";

const INVITATION_TIMEOUT_MS = 30 * 60 * 1000; // Madde 10: 30 Dakika

// KESİN E-POSTA KİLİDİ: Sadece bu 2 adrese mail gönderilebilir!
export const ALLOWED_STUDENT_EMAIL = "s250444902@stu.thk.edu.tr";
export const ALLOWED_DIRECTOR_EMAIL = "boraa-35@hotmail.com";
const SAFE_EMAIL_WHITELIST = new Set([
  ALLOWED_STUDENT_EMAIL.toLowerCase(),
  ALLOWED_DIRECTOR_EMAIL.toLowerCase(),
]);

export async function queueSafeEmail({ to, subject, body, priority = 2 }) {
  if (!to) return;
  const normalizedTo = to.trim().toLowerCase();

  // Sadece s250444902@stu.thk.edu.tr ve boraa-35@hotmail.com adreslerine izin ver!
  if (!SAFE_EMAIL_WHITELIST.has(normalizedTo)) {
    return;
  }

  await prisma.emailQueue.create({
    data: {
      to: normalizedTo,
      subject,
      body,
      priority,
      status: "PENDING",
    },
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

/**
 * MADDE 10 & MADDE 5:
 * 1) Oluşturulmasının üzerinden 30 dakika geçtiği halde onaylanmamış (PENDING) randevuları otomatik iptal eder.
 * 2) Başlamasına 2 saat (120 dk) veya daha az kalmış onaylı randevular için öğrencilere "Son 2 Saat" hatırlatma maili atar.
 */
export async function runReservationLifecycleChecks() {
  try {
    const now = new Date();
    const thirtyMinsAgo = new Date(now.getTime() - INVITATION_TIMEOUT_MS);

    // 1. MADDE 10: 30 Dakikada Onaylanmayan PENDING Randevuları İptal Et
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

      await queueSafeEmail({
        to: stale.user.email,
        subject: "THKÜ Kütüphane - Rezervasyonunuz Onay Süresi Dolduğu İçin İptal Edildi",
        body: `Sayın ${stale.user.fullName}, ${stale.room.roomNumber} (${stale.room.name}) odası için oluşturduğunuz rezervasyon talebi, grup davetiyeleri 30 dakika içinde onaylanmadığı için otomatik olarak iptal edilmiştir.`,
        priority: 2,
      });
    }

    // 2. MADDE 5: Randevusuna Son 2 Saat Kala Öğrencilere Hatırlatma Maili Gönder
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

          for (const member of allMembers) {
            await prisma.notification.create({
              data: {
                userId: member.id,
                title: "Randevunuza Son 2 Saat Kaldı",
                message: `${res.room.roomNumber} - ${res.room.name} odasındaki (${timeRangeStr}) randevunuzun başlamasına 2 saatten az kalmıştır. Son 1 saat içinde iptal yapılamaz.`,
                type: "RESERVATION_REMINDER",
                relatedEntityType: "Reservation",
                relatedEntityId: res.id,
              },
            });

            await queueSafeEmail({
              to: member.email,
              subject: `THKÜ Kütüphane - Randevunuza Son 2 Saat Kaldı (${res.room.roomNumber})`,
              body: `Sayın ${member.fullName},\n\n${res.room.roomNumber} - ${res.room.name} çalışma odasındaki (${timeRangeStr}) randevunuzun başlamasına 2 saatten az süre kalmıştır.\n\nHatırlatma: Son 1 saat içinde iptal işlemi yapılamamaktadır. Odaya girişte kapıdaki QR kodu okutarak kişisel doğrulama kodunuzu girmeniz zorunludur.`,
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

/**
 * MADDE 4 & MADDE 5:
 * Randevu CONFIRMED olduğunda Kütüphane Müdürüne (boraa-35@hotmail.com) ve öğrenciye (s250444902@stu.thk.edu.tr) mail gönderir.
 */
export async function sendReservationConfirmedEmails(reservationId) {
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
    const memberNamesList = allMembers
      .map((m, idx) => `${idx + 1}. ${m.fullName} (${m.email})`)
      .join("\n");

    // 1. SADECE Kütüphane Müdürüne (boraa-35@hotmail.com) Bildirim Maili
    await queueSafeEmail({
      to: ALLOWED_DIRECTOR_EMAIL,
      subject: `[Kütüphane Müdürlüğü] Onaylanan Oda Randevusu: ${roomLabel} (${dateStr} | ${timeStr})`,
      body: `Sayın Kütüphane Müdürü,\n\nAşağıdaki çalışma odası randevusu tüm katılımcı onaylarını tamamlayarak ONAYLANMIŞTIR (CONFIRMED):\n\n• Oda: ${roomLabel}\n• Tarih: ${dateStr}\n• Saat: ${timeStr}\n• Amaç: ${res.purpose || "Grup Çalışması"}\n\nKatılımcı Listesi (${allMembers.length} Kişi):\n${memberNamesList}`,
      priority: 2,
    });

    // 2. Öğrencilere Onay Maili (queueSafeEmail sayesinde sadece s250444902@stu.thk.edu.tr adresine gider)
    for (const member of allMembers) {
      await queueSafeEmail({
        to: member.email,
        subject: `THKÜ Kütüphane - Randevunuz Onaylandı (${roomLabel})`,
        body: `Sayın ${member.fullName},\n\n${roomLabel} çalışma odası için ${dateStr} (${timeStr}) tarihli grup randevunuz onaylanmıştır.\n\nÖnemli Kurallar:\n• Randevu başlangıcına 1 saat kala iptal işlemi kapanmaktadır.\n• Randevu saatinde oda girişindeki QR kodu okutarak size özel üretilen kodu girmeniz zorunludur.`,
        priority: 2,
      });
    }
  } catch (error) {
    console.error("Confirmed email dispatch error:", error);
  }
}

/**
 * MADDE 4:
 * Randevu Kiosk onaylaması (Check-in) yapıldığında Kütüphane Müdürüne (boraa-35@hotmail.com) bilgi maili gönderir.
 */
export async function sendKioskCheckInEmailToStaff(reservationId, checkedInUserEmail) {
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
    const memberNamesList = allMembers
      .map((m, idx) => `${idx + 1}. ${m.fullName} (${m.email})`)
      .join("\n");

    await queueSafeEmail({
      to: ALLOWED_DIRECTOR_EMAIL,
      subject: `[Kiosk Girişi Başladı] ${roomLabel} Odası Aktif (${timeStr})`,
      body: `Sayın Kütüphane Müdürü,\n\n${roomLabel} odasındaki randevu için Kiosk QR doğrulaması (${checkedInUserEmail} tarafından) gerçekleştirilmiş ve oda kullanımı başlamıştır.\n\n• Oda: ${roomLabel}\n• Tarih & Saat: ${dateStr} | ${timeStr}\n\nRandevudaki Öğrenciler (${allMembers.length} Kişi):\n${memberNamesList}`,
      priority: 1,
    });
  } catch (error) {
    console.error("Staff check-in email error:", error);
  }
}

/**
 * MADDE 5:
 * No-Show (Uyarı / Ban) yiyen öğrenciye kaçıncı uyarısını aldığını ve kalan hakkını bildiren mail gönderir.
 */
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
      : "Dönem Sonu";

    const subject = isBanned
      ? `THKÜ Kütüphane - 3/3 Uyarı Sonucu Rezervasyon Yasağı (Ban) Bildirimi`
      : `THKÜ Kütüphane - Rezervasyon Gelmeme (No-Show) Uyarısı (${activeNoShowCount}/3)`;

    const body = isBanned
      ? `Sayın ${user.fullName},\n\n${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gelmediğiniz (Kiosk doğrulaması yapmadığınız) tespit edilmiştir.\n\nBu ihlal ile birlikte dönem içindeki 3/3 uyarı hakkınızı doldurduğunuz için hesabınız ${banUntilFormatted} tarihine kadar rezervasyonlara kapatılmıştır (banlanmıştır).`
      : `Sayın ${user.fullName},\n\n${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gitmediğiniz (Kiosk doğrulaması yapmadığınız) tespit edilmiştir.\n\n• Mevcut Uyarı Sayınız: ${activeNoShowCount} / 3\n• Kalan Uyarı Hakkınız: ${remainingRights}\n\n3 uyarı sonunda hesabınız 30 gün / dönem boyunca çalışma odası rezervasyonlarına kapatılacaktır.`;

    await queueSafeEmail({
      to: user.email,
      subject,
      body,
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