import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import crypto from "crypto";
import { sendKioskCheckInEmailToStaff, getReservationKioskWindow } from "@/lib/lifecycle";

const DEFAULT_TOLERANCE_MINUTES = 15;
const DEFAULT_MIN_CHECKIN_PARTICIPANTS = 2;
const DEVICE_LOCK_TTL = 14400;

// THKÜ Türkkuşu Kampüsü Kütüphane Koordinatları (1 KM Sabit Yarıçap)
const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 39.9458257845895);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 32.69035341292343);
const MAX_DISTANCE_METERS = Number(process.env.LIBRARY_RADIUS_METERS || 1000);

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

function getCrossIncognitoSignature(request) {
  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent") || "no-ua";
  const hwFp = request.headers.get("x-hardware-fp") || "no-hw";
  const netType = request.headers.get("x-net-type") || "unknown";
  const headerDeviceId = request.headers.get("x-device-id") || "no-dev-id";

  const ipUaHash = crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex").substring(0, 20);
  const hwLockHash = crypto.createHash("sha256").update(`${ip}|${hwFp}|${ua}`).digest("hex").substring(0, 20);

  return { ip, hwLockHash, ipUaHash, headerDeviceId, netType };
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
    const { ip, hwLockHash, ipUaHash, headerDeviceId, netType } = getCrossIncognitoSignature(request);
    const body = await request.json();
    const { personalSessionToken, lat, lng } = body;

    if (netType === "cellular") {
      return NextResponse.json(
        { error: "Mobil Veri bağlantısı tespit edildi. Yalnızca Kampüs Wi-Fi (eduroam / THKU-802.1x) üzerinden onay verilebilir." },
        { status: 403 }
      );
    }

    const vpnPrefix = process.env.CAMPUS_VPN_PREFIX || "10.254.";
    if (ip.startsWith(vpnPrefix)) {
      return NextResponse.json(
        { error: "Güvenlik Kuralı: VPN bağlantısı üzerinden oda giriş onayı verilemez." },
        { status: 403 }
      );
    }

    if (process.env.ENFORCE_CAMPUS_GPS !== "false") {
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

    const rulesRows = await prisma.reservationRule.findMany({
      where: {
        isActive: true,
        ruleName: { in: ["CHECKIN_TOLERANCE_MINUTES", "MIN_PARTICIPANTS"] },
      },
      select: { ruleName: true, ruleValue: true },
    });
    const rulesMap = Object.fromEntries(rulesRows.map((r) => [r.ruleName, r.ruleValue?.value]));
    const toleranceMinutes = Number(rulesMap.CHECKIN_TOLERANCE_MINUTES ?? DEFAULT_TOLERANCE_MINUTES);
    const minCheckinParticipants = Math.max(
      2,
      Number(rulesMap.MIN_PARTICIPANTS ?? DEFAULT_MIN_CHECKIN_PARTICIPANTS)
    );

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
      const { minAllowed, maxAllowed } = getReservationKioskWindow(
        r,
        todayStr,
        toleranceMinutes
      );
      return nowTotalMinutes >= minAllowed && nowTotalMinutes <= maxAllowed;
    });

    if (!reservation) {
      return NextResponse.json(
        { error: `Şu anki saat diliminde (±${toleranceMinutes} dk başlangıç penceresi içinde) onaylanabilecek bir randevunuz bulunamadı.` },
        { status: 400 }
      );
    }

    const cookieName = `thku_checkin_lock_${reservation.id}`;
    const cookieOwner = request.cookies.get(cookieName)?.value;
    const deviceKey = `kiosk:device_lock:${reservation.id}:${headerDeviceId}`;
    const hwKey = `kiosk:hw_lock:${reservation.id}:${hwLockHash}`;
    const ipUaKey = `kiosk:ipua_lock:${reservation.id}:${ipUaHash}`;

    const [deviceOwner, hwOwner, ipUaOwner] = await Promise.all([
      redis.get(deviceKey),
      redis.get(hwKey),
      redis.get(ipUaKey),
    ]);

    const lockedOwner = cookieOwner || deviceOwner || hwOwner || ipUaOwner;
    if (lockedOwner && lockedOwner !== currentUserId) {
      return NextResponse.json(
        {
          error:
            "⛔ Güvenlik İhlali (Gizli Sekme / Aynı Cihaz Algılandı): Bu fiziksel cihazdan bu randevu için zaten başka bir öğrenci onay vermiştir. Her katılımcı kendi cihazından QR okutmak zorundadır!",
        },
        { status: 403 }
      );
    }

    const personalOtpKey = `kiosk:personal_otp:${reservation.id}:${currentUserId}`;
    const expectedToken = await redis.get(personalOtpKey);

    if (!expectedToken || expectedToken !== personalSessionToken) {
      return NextResponse.json(
        { error: "Oturum doğrulama anahtarınızın süresi dolmuş. Lütfen kapıdaki QR kodu tekrar okutunuz." },
        { status: 400 }
      );
    }

    await redis.del(personalOtpKey);

    await Promise.all([
      redis.set(deviceKey, currentUserId, "EX", DEVICE_LOCK_TTL),
      redis.set(hwKey, currentUserId, "EX", DEVICE_LOCK_TTL),
      redis.set(ipUaKey, currentUserId, "EX", DEVICE_LOCK_TTL),
    ]);

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
          deviceSignature: hwLockHash,
          progress: `${checkedUserIds.length}/${totalGroupMembers}`,
        },
      },
    });

    if (checkedUserIds.length >= minCheckinParticipants) {
      const transition = await prisma.reservation.updateMany({
        where: {
          id: reservation.id,
          status: "CONFIRMED",
        },
        data: {
          status: "CHECKED_IN",
          checkedInAt: now,
          checkedInById: currentUserId,
        },
      });

      if (transition.count === 1) {
        sendKioskCheckInEmailToStaff(reservation.id, checkedUserIds).catch((err) =>
          console.error("Kiosk staff email error:", err)
        );
      }
    }

    const statusMessage =
      checkedUserIds.length < minCheckinParticipants
        ? `Yoklama kaydınız alındı (${checkedUserIds.length}/${totalGroupMembers}). Randevunun başlaması için en az ${minCheckinParticipants} grup üyesinin kapı QR onayı vermesi gerekmektedir.`
        : `Oda girişiniz onaylandı ve randevunuz resmen başladı! (${checkedUserIds.length}/${totalGroupMembers} katılımcı doğruladı)`;

    const resJson = NextResponse.json({
      success: true,
      reservationId: reservation.id,
      room: reservation.room,
      checkedCount: checkedUserIds.length,
      totalCount: totalGroupMembers,
      message: statusMessage,
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