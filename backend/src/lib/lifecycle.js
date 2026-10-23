import prisma from "@/lib/db";
import nodemailer from "nodemailer";

const INVITATION_TIMEOUT_MS = 30 * 60 * 1000; // Madde 10: 30 Dakika

export const ALLOWED_STUDENT_EMAIL = "s250444902@stu.thk.edu.tr";
export const ALLOWED_DIRECTOR_EMAIL = "boraa-35@hotmail.com";
const SAFE_EMAIL_WHITELIST = new Set([
  ALLOWED_STUDENT_EMAIL.toLowerCase(),
  ALLOWED_DIRECTOR_EMAIL.toLowerCase(),
]);

export async function queueSafeEmail({ to, subject, body, priority = 2 }) {
  if (!to) return;
  let normalizedTo = to.trim().toLowerCase();
  let finalSubject = subject;

  // Demo testi sırasında @demo.local hesaplarına (2., 3., 4. kişi) giden mailleri de
  // test edebilmen için senin öğrenci mailine (s250444902@stu.thk.edu.tr) yönlendiriyoruz.
  if (normalizedTo.endsWith("@demo.local")) {
    finalSubject = `[Demo Alıcı: ${normalizedTo}] ${subject}`;
    normalizedTo = ALLOWED_STUDENT_EMAIL.toLowerCase();
  }

  if (!SAFE_EMAIL_WHITELIST.has(normalizedTo)) {
    return;
  }

  const queued = await prisma.emailQueue.create({
    data: {
      to: normalizedTo,
      subject: finalSubject,
      body,
      priority,
      status: "PENDING",
    },
  });

  console.log(`\n📧 [E-POSTA KUYRUĞA ALINDI] Alıcı: ${normalizedTo} | Konu: ${finalSubject}`);

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, ""); // 16 haneli şifrede boşluk varsa otomatik temizler

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const createTransportFn =
        nodemailer.createTransport || nodemailer.default?.createTransport;

      const transporter = createTransportFn.call(nodemailer, {
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

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"THKÜ Kütüphane Sistemi" <${smtpUser}>`,
        to: normalizedTo,
        subject: finalSubject,
        text: body,
      });

      await prisma.emailQueue.update({
        where: { id: queued.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      console.log(`✅ [GERÇEK E-POSTA BAŞARIYLA İLETİLDİ] -> ${normalizedTo}`);
    } catch (smtpErr) {
      console.error(`❌ [SMTP GÖNDERİM HATASI] (${normalizedTo}):`, smtpErr.message);
      if (smtpErr.message?.includes("535")) {
        console.error(
          `💡 ÇÖZÜM: Gmail normal hesap şifresini kabul etmez. https://myaccount.google.com/apppasswords adresinden 16 harfli 'Uygulama Şifresi' alıp backend/.env içindeki SMTP_PASS satırına yazınız.`
        );
      }

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
  } else {
    console.warn(
      `⚠️ [SMTP EKSİK] backend/.env içinde SMTP_HOST, SMTP_USER veya SMTP_PASS tanımlı değil!`
    );
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

      await queueSafeEmail({
        to: stale.user.email,
        subject: "THKÜ Kütüphane - Rezervasyonunuz Onay Süresi Dolduğu İçin İptal Edildi",
        body: `Sayın ${stale.user.fullName}, ${stale.room.roomNumber} (${stale.room.name}) odası için oluşturduğunuz rezervasyon talebi, grup davetiyeleri 30 dakika içinde onaylanmadığı için otomatik olarak iptal edilmiştir.`,
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
              body: `Sayın ${member.fullName},\n\n${res.room.roomNumber} - ${res.room.name} çalışma odasındaki (${timeRangeStr}) randevunuzun başlamasına 2 saatten az süre kalmıştır.\n\nHatırlatma: Son 1 saat içinde iptal işlemi yapılamamaktadır.`,
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
 * YENİ MAİL MANTIĞI:
 * - isInitialConfirmation === true (2. Kişi Kabul Ettiğinde):
 *   1) Organizatöre + 2. Kişiye onay maili gider.
 *   2) Kütüphane Müdürüne (boraa-35@hotmail.com) hangi odanın kaç kişiyle kimler tarafından ayrıldığı maili gider.
 * - isInitialConfirmation === false (3., 4., 5. ... Kişi Kabul Ettiğinde):
 *   1) SADECE o kabul eden kişiye (3. ise 3.'ye, 4. ise 4.'ye) mail gider.
 *   2) Organizatöre ve Kütüphane Müdürüne tekrar mail GİTMEZ!
 */
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

    // SENARYO 1: 2. KİŞİ KABUL ETTİ -> ODA AYRILDI (CONFIRMED)
    if (isInitialConfirmation) {
      const allGroupPeople = [
        { fullName: res.user.fullName, email: res.user.email, statusLabel: "Organizatör (Onaylı)" },
        ...res.participants.map((p) => ({
          fullName: p.user.fullName,
          email: p.user.email,
          statusLabel: p.status === "ACCEPTED" ? "Katılımcı (Onayladı)" : "Katılımcı (Davet Bekliyor)",
        })),
      ];

      const groupListText = allGroupPeople
        .map((m, idx) => `${idx + 1}. ${m.fullName} (${m.email}) - [${m.statusLabel}]`)
        .join("\n");

      // A) Kütüphane Müdürüne (boraa-35@hotmail.com) Oda Ayrıldı Bilgisi (Sadece 1 kez gider)
      await queueSafeEmail({
        to: ALLOWED_DIRECTOR_EMAIL,
        subject: `[Kütüphane Müdürlüğü] Oda Ayrıldı: ${roomLabel} (${dateStr} | ${timeStr})`,
        body: `Sayın Kütüphane Müdürü,\n\nAşağıdaki çalışma odası en az 2 kişi onay şartını tamamlayarak resmen AYRILMIŞTIR (CONFIRMED):\n\n• Ayrılan Oda: ${roomLabel}\n• Tarih: ${dateStr}\n• Saat Aralığı: ${timeStr}\n• Toplam Grup Sayısı: ${allGroupPeople.length} Kişi (${1 + acceptedParticipants.length} Onaylı)\n• Çalışma Amacı: ${res.purpose || "Grup Çalışması"}\n\nOdayı Ayıran Kişiler:\n${groupListText}`,
        priority: 1,
      });

      // B) Organizatöre ve Onaylayan 2. Kişiye Mail Gönder
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

        await queueSafeEmail({
          to: member.email,
          subject: `THKÜ Kütüphane - Randevunuz Onaylandı (${roomLabel})`,
          body: `Sayın ${member.fullName},\n\n${roomLabel} çalışma odası için ${dateStr} (${timeStr}) tarihli grup randevunuz onaylanmıştır.\n\nÖnemli Kurallar:\n• Randevu başlangıcına 1 saat kala iptal işlemi kapanmaktadır.\n• Randevu saatinde oda girişindeki QR kodu okutarak onay vermeniz zorunludur.`,
          priority: 1,
        });
      }
      return;
    }

    // SENARYO 2: 3., 4., 5., ... KİŞİ KABUL ETTİ (Sadece kabul eden o kişiye mail gider!)
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

      await queueSafeEmail({
        to: acceptingParticipant.email,
        subject: `THKÜ Kütüphane - Randevu Katılımınız Onaylandı (${roomLabel})`,
        body: `Sayın ${acceptingParticipant.fullName},\n\n${roomLabel} çalışma odasındaki ${dateStr} (${timeStr}) tarihli onaylı grup randevusuna katılımınız kaydedilmiştir.\n\nÖnemli Kurallar:\n• Randevu saatinde oda girişindeki QR kodu kendi telefonunuzla okutarak onay vermeniz zorunludur.`,
        priority: 1,
      });
    }
  } catch (error) {
    console.error("Participant accepted email dispatch error:", error);
  }
}

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
      body: `Sayın Kütüphane Müdürü,\n\n${roomLabel} odasındaki randevu için Kapı QR doğrulaması (${checkedInUserEmail} tarafından) gerçekleştirilmiş ve oda kullanımı başlamıştır.\n\n• Oda: ${roomLabel}\n• Tarih & Saat: ${dateStr} | ${timeStr}\n\nRandevudaki Öğrenciler (${allMembers.length} Kişi):\n${memberNamesList}`,
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
      ? `Sayın ${user.fullName},\n\n${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gelmediğiniz (Kapı QR onayı vermediğiniz) tespit edilmiştir.\n\nBu ihlal ile birlikte dönem içindeki 3/3 uyarı hakkınızı doldurduğunuz için hesabınız ${banUntilFormatted} tarihine kadar rezervasyonlara kapatılmıştır.`
      : `Sayın ${user.fullName},\n\n${dateStr} tarihli ${roomLabel} çalışma odası rezervasyonunuza gitmediğiniz (Kapı QR onayı vermediğiniz) tespit edilmiştir.\n\n• Mevcut Uyarı Sayınız: ${activeNoShowCount} / 3\n• Kalan Uyarı Hakkınız: ${remainingRights}\n\n3 uyarı sonunda hesabınız 30 gün / dönem boyunca çalışma odası rezervasyonlarına kapatılacaktır.`;

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