import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import crypto from "crypto";
import { sendKioskCheckInEmailToStaff } from "@/lib/lifecycle";

const TOLERANCE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 300; // 5 dakika Brute-Force kilidi
const DEVICE_LOCK_TTL = 14400; // 4 saat boyunca aynı cihazdan başka öğrenci giremez

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

function getDeviceSignature(request) {
  const headerDeviceId = request.headers.get("x-device-id") || "no-dev-id";
  const userAgent = request.headers.get("user-agent") || "no-ua";
  const ip = getClientIp(request);
  const rawFingerprint = `${ip}|${userAgent}`;
  const uaHash = crypto.createHash("sha256").update(rawFingerprint).digest("hex").substring(0, 16);
  return { headerDeviceId, uaHash, ip };
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id;
  const attemptKey = `kiosk:attempts:${currentUserId}`;

  try {
    // 1. Kampüs Wi-Fi (eduroam) Ağ Kontrolü (.env içinde ENFORCE_CAMPUS_WIFI="true" ise çalışır)
    const { headerDeviceId, uaHash, ip } = getDeviceSignature(request);
    if (process.env.ENFORCE_CAMPUS_WIFI === "true") {
      const allowedPrefix = process.env.CAMPUS_IP_PREFIX || "193.255.";
      const isLocal = ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.");
      if (!ip.startsWith(allowedPrefix) && !isLocal) {
        return NextResponse.json(
          { error: "Güvenlik Kuralı: Oda giriş doğrulaması yalnızca THKÜ Kampüs Wi-Fi (eduroam) ağı üzerinden yapılabilir." },
          { status: 403 }
        );
      }
    }

    // 2. Brute-Force (Deneme-Yanılma) Kontrolü
    const attempts = Number((await redis.get(attemptKey)) || 0);
    if (attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Çok fazla hatalı kod denemesi yaptınız. Lütfen 5 dakika sonra tekrar deneyiniz." },
        { status: 429 }
      );
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Kişisel doğrulama kodunuzu giriniz." }, { status: 400 });
    }

    // 3. Öğrencinin Şu Anki Aktif Randevusunu Bul
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const todayDate = new Date(`${todayStr}T00:00:00Z`);

    const trTimeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const currentHour = Number(trTimeParts.find((p) => p.type === "hour").value);
    const currentMinute = Number(trTimeParts.find((p) => p.type === "minute").value);
    const nowTotalMinutes = currentHour * 60 + currentMinute;

    const winStartMinutes = Math.max(0, nowTotalMinutes - TOLERANCE_MINUTES);
    const winEndMinutes = Math.min(24 * 60 - 1, nowTotalMinutes + TOLERANCE_MINUTES);

    const windowStart = new Date(
      Date.UTC(1970, 0, 1, Math.floor(winStartMinutes / 60), winStartMinutes % 60, 0)
    );
    const windowEnd = new Date(
      Date.UTC(1970, 0, 1, Math.floor(winEndMinutes / 60), winEndMinutes % 60, 59)
    );

    const reservation = await prisma.reservation.findFirst({
      where: {
        reservationDate: todayDate,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        startTime: { lte: windowEnd },
        endTime: { gte: windowStart },
        OR: [
          { userId: currentUserId },
          {
            participants: {
              some: { userId: currentUserId, status: "ACCEPTED" },
            },
          },
        ],
      },
      include: {
        room: { select: { id: true, roomNumber: true, name: true } },
        user: { select: { id: true, email: true } },
        participants: {
          where: { status: "ACCEPTED" },
          include: { user: { select: { id: true, email: true } } },
        },
      },
      orderBy: { startTime: "asc" },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Şu an için başlayan (±15 dk) onaylı bir rezervasyonunuz bulunamadı." },
        { status: 404 }
      );
    }

    // CİHAZ KİLİDİ KONTROLÜ (Başkasının Hesabına Girip Onaylamayı Engelleme)
    const cookieName = `thku_checkin_lock_${reservation.id}`;
    const cookieOwner = request.cookies.get(cookieName)?.value;
    const deviceKey = `kiosk:device_lock:${reservation.id}:${headerDeviceId}`;
    const deviceOwner = await redis.get(deviceKey);

    if ((cookieOwner && cookieOwner !== currentUserId) || (deviceOwner && deviceOwner !== currentUserId)) {
      return NextResponse.json(
        {
          error:
            "Güvenlik İhlali (Madde 15): Bu cihazdan bu randevu için zaten başka bir öğrenci giriş doğrulaması yapmıştır. Her katılımcı kendi cihazından kendi kodunu girmek zorundadır!",
        },
        { status: 403 }
      );
    }

    //  KİŞİYE ÖZEL 10 DAKİKALIK KOD DOĞRULAMASI
    const personalOtpKey = `kiosk:personal_otp:${reservation.id}:${currentUserId}`;
    const expectedPersonalToken = await redis.get(personalOtpKey);

    if (!expectedPersonalToken || expectedPersonalToken !== token.trim().toUpperCase()) {
      const newCount = await redis.incr(attemptKey);
      if (newCount === 1) {
        await redis.expire(attemptKey, LOCK_SECONDS);
      }
      const remaining = Math.max(0, MAX_ATTEMPTS - newCount);
      return NextResponse.json(
        {
          error: `Geçersiz veya 10 dakikalık süresi dolmuş kişisel kod! Lütfen size özel üretilen kodu giriniz. (Kalan deneme: ${remaining})`,
        },
        { status: 400 }
      );
    }

    // Doğru girildiyse hatalı deneme sayacını ve tek kullanımlık kişisel kodu sil
    await redis.del(attemptKey);
    await redis.del(personalOtpKey);

    // 6. Cihazı Bu Öğrenciye Mühürle ve Öğrenciyi "Kodu Girenler" Listesine Ekle
    await redis.set(deviceKey, currentUserId, "EX", DEVICE_LOCK_TTL);

    const checkedSetKey = `kiosk:checked_users:${reservation.id}`;
    await redis.sadd(checkedSetKey, currentUserId);
    await redis.expire(checkedSetKey, DEVICE_LOCK_TTL);

    const checkedUserIds = await redis.smembers(checkedSetKey);
    const totalGroupMembers = 1 + reservation.participants.length;

    const roomTitle = [reservation.room.roomNumber, reservation.room.name].join(" ");

    // Bireysel Check-in Logu
    await prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: "RESERVATION_CHECKED_IN",
        entityType: "Reservation",
        entityId: reservation.id,
        newData: {
          room: roomTitle,
          checkedInBy: session.user.email,
          deviceSignature: uaHash,
          progress: `${checkedUserIds.length}/${totalGroupMembers}`,
        },
      },
    });

    // En az 2 kişi (veya ilk doğrulama) tamamlandığında odayı CHECKED_IN yap ve Görevliye Mail Gönder 
    if (reservation.status !== "CHECKED_IN") {
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: "CHECKED_IN",
          checkedInAt: now,
          checkedInById: currentUserId,
        },
      });

      await sendKioskCheckInEmailToStaff(reservation.id, session.user.email);
    }

    const startHour = new Date(reservation.startTime).getUTCHours();
    const startMin = new Date(reservation.startTime).getUTCMinutes();
    const endDt = new Date(reservation.endTime);
    const endHour = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
    const endMin = endHour === 24 ? 0 : endDt.getUTCHours();

    const fmtTime = (h, m) =>
      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const resJson = NextResponse.json({
      success: true,
      reservationId: reservation.id,
      room: reservation.room,
      startTime: fmtTime(startHour, startMin),
      endTime: fmtTime(endHour, endMin),
      checkedCount: checkedUserIds.length,
      totalCount: totalGroupMembers,
      message: `Kişisel kodunuz doğrulandı! (${checkedUserIds.length}/${totalGroupMembers} katılımcı giriş yaptı)`,
    });

    // Tarayıcıya HttpOnly Cihaz Kilidi Çerezi Mühürle (Farklı hesaba geçişi engeller)
    resJson.cookies.set(cookieName, currentUserId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: DEVICE_LOCK_TTL,
      path: "/",
    });

    return resJson;
  } catch (error) {
    console.error("Check-in validate error:", error);
    return NextResponse.json(
      { error: "Doğrulama sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}