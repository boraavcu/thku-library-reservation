import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import crypto from "crypto";

const PERSONAL_OTP_TTL = 600; // Kişiye özel kod 10 dakika (600 sn) geçerli
const ALLOWED_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePersonalCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += ALLOWED_CHARS[bytes[i] % ALLOWED_CHARS.length];
  }
  return token;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userRole = session.user.role;
  const isStaff = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"].includes(userRole);

  try {
    // 1. GÖREVLİ / MÜDÜR / BİM İSE: 4 Odaya Asılacak Tekil Sabit QR Bilgilerini Dön
    if (isStaff) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const singleDoorQrUrl = `${frontendUrl}/kiosk?door=thku-study-room`;

      return NextResponse.json({
        mode: "STAFF_POSTER",
        doorQrUrl: singleDoorQrUrl,
        ttlSeconds: PERSONAL_OTP_TTL,
        message: "Bu QR kod tüm çalışma odalarının (R101-R104) kapısına ortak olarak asılır.",
      });
    }

    // 2. ÖĞRENCİ İSE: Bugünkü Aktif Randevusunu Bul ve Kişiye Özel 10 Dakikalık Kod Üret
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const todayDate = new Date(`${todayStr}T00:00:00Z`);

    const trTimeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const curH = Number(trTimeParts.find((p) => p.type === "hour").value);
    const curM = Number(trTimeParts.find((p) => p.type === "minute").value);
    const nowMins = curH * 60 + curM;

    const winStartMins = Math.max(0, nowMins - 15);
    const winEndMins = Math.min(24 * 60 - 1, nowMins + 15);

    const windowStart = new Date(Date.UTC(1970, 0, 1, Math.floor(winStartMins / 60), winStartMins % 60, 0));
    const windowEnd = new Date(Date.UTC(1970, 0, 1, Math.floor(winEndMins / 60), winEndMins % 60, 59));

    const reservation = await prisma.reservation.findFirst({
      where: {
        reservationDate: todayDate,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        startTime: { lte: windowEnd },
        endTime: { gte: windowStart },
        OR: [
          { userId },
          { participants: { some: { userId, status: "ACCEPTED" } } },
        ],
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
        participants: {
          where: { status: "ACCEPTED" },
          include: { user: { select: { id: true, fullName: true, email: true } } },
        },
      },
      orderBy: { startTime: "asc" },
    });

    if (!reservation) {
      return NextResponse.json({
        mode: "STUDENT_NO_ACTIVE_BOOKING",
        error: "Şu anki saat diliminde (±15 dk) onaylanmış aktif bir oda randevunuz bulunmamaktadır.",
      });
    }

    const checkedSetKey = `kiosk:checked_users:${reservation.id}`;
    const checkedUserIds = await redis.smembers(checkedSetKey);
    const alreadyCheckedIn = checkedUserIds.includes(userId);

    // Kişiye özel 10 dakikalık OTP anahtarı
    const otpKey = `kiosk:personal_otp:${reservation.id}:${userId}`;
    let personalCode = await redis.get(otpKey);
    let remainingSeconds = await redis.ttl(otpKey);

    if (!alreadyCheckedIn && (!personalCode || remainingSeconds <= 0)) {
      personalCode = generatePersonalCode(6);
      await redis.set(otpKey, personalCode, "EX", PERSONAL_OTP_TTL);
      remainingSeconds = PERSONAL_OTP_TTL;

      const roomTitle = [reservation.room.roomNumber, reservation.room.name].join(" - ");

      // Öğrencinin bildirim ziline ve e-posta kuyruğuna kişisel kodunu gönder
      await prisma.notification.create({
        data: {
          userId,
          title: `Kişisel Kapı Kodu: ${personalCode}`,
          message: `${roomTitle} odasına giriş için size özel üretilen 10 dakika geçerli doğrulama kodunuz: ${personalCode}`,
          type: "KIOSK_OTP",
          relatedEntityType: "Reservation",
          relatedEntityId: reservation.id,
        },
      });

      await prisma.emailQueue.create({
        data: {
          to: session.user.email,
          subject: `THKÜ Kütüphane - Kişisel Oda Giriş Kodunuz: ${personalCode}`,
          body: `Sayın ${session.user.name || session.user.email},\n\n${roomTitle} çalışma odasına giriş için size özel üretilen ve 10 dakika geçerli olan doğrulama kodunuz:\n\n👉 ${personalCode}\n\nNot: Her katılımcı kendi mobil cihazından kendi kişisel kodunu girmek zorundadır.`,
          priority: 1,
          status: "PENDING",
        },
      });
    }

    const allMembers = [
      { id: reservation.user.id, fullName: reservation.user.fullName, email: reservation.user.email, role: "Organizatör" },
      ...reservation.participants.map((p) => ({
        id: p.user.id,
        fullName: p.user.fullName,
        email: p.user.email,
        role: "Katılımcı",
      })),
    ].map((m) => ({
      ...m,
      hasCheckedIn: checkedUserIds.includes(m.id),
    }));

    return NextResponse.json({
      mode: "STUDENT_ACTIVE",
      reservationId: reservation.id,
      room: reservation.room,
      personalCode: alreadyCheckedIn ? null : personalCode,
      ttl: alreadyCheckedIn ? 0 : Math.max(0, remainingSeconds),
      alreadyCheckedIn,
      members: allMembers,
      checkedCount: checkedUserIds.length,
      totalCount: allMembers.length,
    });
  } catch (error) {
    console.error("Kiosk QR/Personal OTP error:", error);
    return NextResponse.json({ error: "Kod üretilirken hata oluştu." }, { status: 500 });
  }
}