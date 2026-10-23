import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import crypto from "crypto";
import { sendKioskCheckInEmailToStaff } from "@/lib/lifecycle";

const TOLERANCE_MINUTES = 15; // Başlangıç saatine ±15 dk kuralı (Örn: 10:00 -> 09:45 - 10:15)
const DEVICE_LOCK_TTL = 14400; // 4 saat boyunca aynı cihazdan başka öğrenci onay veremez

const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 39.9482);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 32.6881);
const MAX_DISTANCE_METERS = Number(process.env.LIBRARY_RADIUS_METERS || 250);

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

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUserId = session.user.id;

  try {
    const { headerDeviceId, uaHash, ip } = getDeviceSignature(request);
    const body = await request.json();
    const { personalSessionToken, lat, lng } = body;

    // 1. KAMPÜS WI-FI & ANTI-VPN KONTROLÜ
    const vpnPrefix = process.env.CAMPUS_VPN_PREFIX || "10.254.";
    if (ip.startsWith(vpnPrefix)) {
      return NextResponse.json(
        { error: "Güvenlik Kuralı: VPN bağlantısı üzerinden oda giriş onayı verilemez." },
        { status: 403 }
      );
    }

    if (process.env.ENFORCE_CAMPUS_WIFI === "true") {
      const allowedPrefix = process.env.CAMPUS_IP_PREFIX || "193.255.";
      const isLocal = ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.");
      if (!ip.startsWith(allowedPrefix) && !isLocal) {
        return NextResponse.json(
          { error: "Güvenlik Kuralı: Oda giriş onayı yalnızca THKÜ Kampüs Wi-Fi (eduroam) ağı üzerinden yapılabilir." },
          { status: 403 }
        );
      }
    }

    // 2. GPS KONUM KONTROLÜ
    if (process.env.ENFORCE_CAMPUS_GPS === "true") {
      if (typeof lat !== "number" || typeof lng !== "number") {
        return NextResponse.json(
          { error: "Fiziksel konum doğrulaması için tarayıcı GPS izni gereklidir." },
          { status: 403 }
        );
      }
      const dist = calculateDistanceMeters(lat, lng, LIBRARY_LAT, LIBRARY_LNG);
      if (dist > MAX_DISTANCE_METERS) {
        return NextResponse.json(
          { error: `Kütüphane binası sınırları dışındasınız (${dist}m). Uzaktan onay verilemez.` },
          { status: 403 }
        );
      }
    }

    // 3. BUGÜNKÜ RANDEVUYU VE ±15 DAKİKA BAŞLANGIÇ PENCERESİNİ BUL
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

    const todayReservations = await prisma.reservation.findMany({
      where: {
        reservationDate: todayDate,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
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

    const reservation = todayReservations.find((r) => {
      const sH = new Date(r.startTime).getUTCHours();
      const sM = new Date(r.startTime).getUTCMinutes();
      const startMins = sH * 60 + sM;
      return (
        nowTotalMinutes >= startMins - TOLERANCE_MINUTES &&
        nowTotalMinutes <= startMins + TOLERANCE_MINUTES
      );
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Şu anki saat diliminde (±15 dk başlangıç penceresi içinde) onaylanabilecek bir randevunuz bulunamadı." },
        { status: 400 }
      );
    }

    // 4. CİHAZ KİLİDİ KONTROLÜ (Aynı Telefondan Başka Hesaba Girip Onay Vermeyi Önler)
    const cookieName = `thku_checkin_lock_${reservation.id}`;
    const cookieOwner = request.cookies.get(cookieName)?.value;
    const deviceKey = `kiosk:device_lock:${reservation.id}:${headerDeviceId}`;
    const deviceOwner = await redis.get(deviceKey);

    if ((cookieOwner && cookieOwner !== currentUserId) || (deviceOwner && deviceOwner !== currentUserId)) {
      return NextResponse.json(
        {
          error:
            "Güvenlik İhlali: Bu mobil cihazdan bu randevu için zaten başka bir öğrenci onay vermiştir. Her katılımcı kendi cihazından QR okutmak zorundadır!",
        },
        { status: 403 }
      );
    }

    // 5. ARKA PLAN KİŞİSEL OTURUM ANAHTARI DOĞRULAMASI
    const personalOtpKey = `kiosk:personal_otp:${reservation.id}:${currentUserId}`;
    const expectedToken = await redis.get(personalOtpKey);

    if (!expectedToken || expectedToken !== personalSessionToken) {
      return NextResponse.json(
        { error: "Oturum doğrulama anahtarınızın süresi dolmuş. Lütfen kapıdaki QR kodu tekrar okutunuz." },
        { status: 400 }
      );
    }

    await redis.del(personalOtpKey);

    // 6. CİHAZI MÜHÜRLE VE ÖĞRENCİYİ YOKLAMA LİSTESİNE EKLE
    await redis.set(deviceKey, currentUserId, "EX", DEVICE_LOCK_TTL);

    const checkedSetKey = `kiosk:checked_users:${reservation.id}`;
    await redis.sadd(checkedSetKey, currentUserId);
    await redis.expire(checkedSetKey, DEVICE_LOCK_TTL);

    const checkedUserIds = await redis.smembers(checkedSetKey);
    const totalGroupMembers = 1 + reservation.participants.length;
    const roomTitle = [reservation.room.roomNumber, reservation.room.name].join(" ");

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

    const resJson = NextResponse.json({
      success: true,
      reservationId: reservation.id,
      room: reservation.room,
      checkedCount: checkedUserIds.length,
      totalCount: totalGroupMembers,
      message: `Oda girişiniz başarıyla onaylandı! (${checkedUserIds.length}/${totalGroupMembers} katılımcı doğruladı)`,
    });

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
      { error: "Onay işlemi sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}