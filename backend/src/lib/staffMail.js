import nodemailer from "nodemailer";
import prisma from "@/lib/db";
import { getFrontendBaseUrl } from "@/lib/publicPaths";
import { buildTempPasswordQueueRecord, normalizeEmail } from "@/lib/staffAuth.mjs";

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (!smtpHost || !smtpUser || !smtpPass) return null;

  const createTransportFn = nodemailer.createTransport || nodemailer.default?.createTransport;
  return createTransportFn.call(nodemailer, {
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });
}

function messageText({ fullName, email, temporaryPassword, expiresAt }) {
  const loginUrl = `${getFrontendBaseUrl()}/`;
  const expiresText = new Date(expiresAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  return [
    `Merhaba ${fullName},`,
    "",
    "THKÜ Kütüphane randevu sistemi için kurumsal hesabınız hazır.",
    `Giriş adresi: ${loginUrl}`,
    `E-posta: ${email}`,
    `Geçici şifre: ${temporaryPassword}`,
    `Geçici şifrenin son kullanma zamanı: ${expiresText} (24 saat).`,
    "",
    "İlk girişte yeni bir kalıcı şifre belirlemeniz gerekir.",
    "Geçici şifreyle yalnızca şifre değiştirme ekranı açılır; uygulama ve yönetim işlemleri kapalıdır.",
    "Kalıcı şifre kaydedildikten sonra yeniden normal giriş yapın.",
  ].join("\n");
}

export async function deliverTempPasswordEmail({ to, fullName, temporaryPassword, expiresAt }) {
  const email = normalizeEmail(to);
  const text = messageText({ fullName, email, temporaryPassword, expiresAt });
  let smtpAccepted = false;
  let errorMessage = null;
  const transporter = createTransporter();
  const smtpUser = process.env.SMTP_USER?.trim();

  if (!transporter || !smtpUser) {
    errorMessage = "SMTP ayarları yok";
  } else {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"THKÜ Kütüphane Sistemi" <${smtpUser}>`,
        to: email,
        subject: "THKÜ Kütüphane — geçici giriş bilgisi",
        text,
      });
      smtpAccepted = true;
    } catch (error) {
      errorMessage = error?.message || "SMTP hatası";
    }
  }

  const record = buildTempPasswordQueueRecord({
    to: email,
    smtpAccepted,
    errorMessage,
    secret: temporaryPassword,
  });

  try {
    await prisma.emailQueue.create({
      data: {
        to: record.to,
        subject: record.subject,
        body: record.body,
        htmlBody: record.htmlBody,
        status: record.status,
        metadata: record.metadata,
        errorMessage: record.errorMessage,
        sentAt: smtpAccepted ? new Date() : null,
        failedAt: smtpAccepted ? null : new Date(),
        attempts: 1,
      },
    });
  } catch {
    console.error("Geçici şifre bildirim kaydı yazılamadı.");
  }

  return {
    smtpAccepted,
    deliveredToUser: false,
    message: smtpAccepted
      ? "Posta sunucusu iletiyi kabul etti. Bu, iletinin kullanıcının kutusuna ulaştığı anlamına gelmez."
      : "E-posta gönderilemedi. Hesap silinmedi ve ikinci hesap açılmadı.",
  };
}
