import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import crypto from "crypto";

const PERSONAL_OTP_TTL = 600; // Kişiye özel oturum anahtarı 10 dakika geçerli
const TOLERANCE_MINUTES = 15; // Başlangıç saatine ±15 dakika kuralı (Örn: 10:00 -> 09:45 - 10:15)

// THKÜ Türkkuşu Kampüsü Kütüphane Koordinatları (Etimesgut / Ankara)
const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 39.9482);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 32.6881);
const MAX_DISTANCE_METERS = Number(process.env.LIBRARY_RADIUS_METERS || 250);

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

// Haversine formülü ile öğrenci GPS koordinatı ve kütüphane arasındaki mesafeyi (metre) hesaplar
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

function fmtMinsToTime(totalMins) {
  const normalized = Math.max(0, Math.min(24 * 60, totalMins));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET(request) {
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

    // 2. ÖĞRENCİ İSE: Kapıdaki QR Kodun Okutulup Okutulmadığını Kontrol Et (?door=thku-study-room)
    const { searchParams } = new URL(request.url);
    const doorParam = searchParams.get("door");

    if (doorParam !== "thku-study-room") {
      return NextResponse.json({
        mode: "DOOR_QR_REQUIRED",
        error:
          "Yoklama ekranına anasayfadan veya doğrudan linkle girilemez. Lütfen çalışma odasının kapısındaki fiziksel QR kodu telefon kameranızla okutunuz.",
      });
    }

    // 3. KAMPÜS WI-FI & ANTI-VPN KONTROLÜ
    const ip = getClientIp(request);
    const enforceCampusNetwork = process.env.ENFORCE_CAMPUS_WIFI === "true";
    const allowedPrefix = process.env.CAMPUS_IP_PREFIX || "193.255.";
    const vpnPrefix = process.env.CAMPUS_VPN_PREFIX || "10.254."; // BİM VPN IP bloğu

    if (ip.startsWith(vpnPrefix)) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error:
          "Güvenlik İhlali: Kampüs VPN bağlantısı üzerinden uzaktan kapı QR doğrulaması yapılamaz. Lütfen kütüphanede fiziksel olarak bulununuz.",
      });
    }

    if (enforceCampusNetwork) {
      const isLocal = ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.");
      if (!ip.startsWith(allowedPrefix) && !isLocal) {
        return NextResponse.json({
          mode: "LOCATION_BLOCKED",
          error:
            "Kampüs Wi-Fi (eduroam) ağına bağlı olmadığınız tespit edildi. Evden veya mobil veri üzerinden kapı QR kodu açılamaz.",
        });
      }
    }

    // 4. GPS FİZİKSEL KONUM DOĞRULAMASI (VPN veya WhatsApp Fotoğraf Paylaşımını Engeller)
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const enforceGps = process.env.ENFORCE_CAMPUS_GPS === "true";

    let distanceMeters = null;
    if (latParam !== null && lngParam !== null) {
      const userLat = parseFloat(latParam);
      const userLng = parseFloat(lngParam);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        distanceMeters = calculateDistanceMeters(userLat, userLng, LIBRARY_LAT, LIBRARY_LNG);
        if (enforceGps && distanceMeters > MAX_DISTANCE_METERS) {
          return NextResponse.json({
            mode: "LOCATION_BLOCKED",
            error: `Fiziksel Konum Hatası: Kütüphane binasına ${distanceMeters} metre uzaklıktasınız (Maksimum sınır: ${MAX_DISTANCE_METERS}m). VPN açık olsa dahi kütüphane dışından onay verilemez.`,
          });
        }
      }
    } else if (enforceGps) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error: "Oda girişini onaylayabilmek için tarayıcınızın Konum (GPS) iznini açmanız zorunludur.",
      });
    }

    // 5. ÖĞRENCİNİN BUGÜNKÜ RANDEVUSUNU VE ±15 DAKİKA PENCERESİNİ KONTROL ET
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

    const todayReservations = await prisma.reservation.findMany({
      where: {
        reservationDate: todayDate,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
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

    if (todayReservations.length === 0) {
      return NextResponse.json({
        mode: "STUDENT_NO_ACTIVE_BOOKING",
        error: "Bugün için onaylanmış aktif bir çalışma odası randevunuz bulunmamaktadır.",
      });
    }

    // Başlangıç saatine ±15 dakika içinde olan (Örn: 10:00 randevusu için 09:45 - 10:15 arası) randevuyu bul
    let matchedReservation = null;
    let windowInfoError = null;

    for (const r of todayReservations) {
      const sH = new Date(r.startTime).getUTCHours();
      const sM = new Date(r.startTime).getUTCMinutes();
      const startTotalMins = sH * 60 + sM;
      const minAllowed = startTotalMins - TOLERANCE_MINUTES;
      const maxAllowed = startTotalMins + TOLERANCE_MINUTES;

      if (nowMins >= minAllowed && nowMins <= maxAllowed) {
        matchedReservation = r;
        break;
      } else {
        windowInfoError = `${r.room.roomNumber} - ${r.room.name} odasındaki ${fmtMinsToTime(
          startTotalMins
        )} randevunuz için kapı QR onayı yalnızca ±15 dakika içinde (${fmtMinsToTime(
          minAllowed
        )} – ${fmtMinsToTime(maxAllowed)} saatleri arasında) yapılabilir. Şu anki saat: ${fmtMinsToTime(nowMins)}`;
      }
    }

    if (!matchedReservation) {
      return NextResponse.json({
        mode: "OUTSIDE_TIME_WINDOW",
        error:
          windowInfoError ||
          "Şu anki saat, randevunuzun ±15 dakikalık başlangıç onay penceresi dışındadır.",
      });
    }

    const sH = new Date(matchedReservation.startTime).getUTCHours();
    const sM = new Date(matchedReservation.startTime).getUTCMinutes();
    const startTotalMins = sH * 60 + sM;
    const windowLabel = `${fmtMinsToTime(startTotalMins - TOLERANCE_MINUTES)} – ${fmtMinsToTime(
      startTotalMins + TOLERANCE_MINUTES
    )}`;

    const checkedSetKey = `kiosk:checked_users:${matchedReservation.id}`;
    const checkedUserIds = await redis.smembers(checkedSetKey);
    const alreadyCheckedIn = checkedUserIds.includes(userId);

    // Arka planda bu öğrenciye özel kriptografik tek kullanımlık onay anahtarı üret (ekranda elle yazılmaz)
    const otpKey = `kiosk:personal_otp:${matchedReservation.id}:${userId}`;
    let personalSessionToken = await redis.get(otpKey);

    if (!alreadyCheckedIn && !personalSessionToken) {
      personalSessionToken = crypto.randomBytes(16).toString("hex");
      await redis.set(otpKey, personalSessionToken, "EX", PERSONAL_OTP_TTL);
    }

    const allMembers = [
      {
        id: matchedReservation.user.id,
        fullName: matchedReservation.user.fullName,
        email: matchedReservation.user.email,
        role: "Organizatör",
      },
      ...matchedReservation.participants.map((p) => ({
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
      reservationId: matchedReservation.id,
      room: matchedReservation.room,
      windowLabel,
      distanceMeters,
      personalSessionToken: alreadyCheckedIn ? null : personalSessionToken,
      alreadyCheckedIn,
      members: allMembers,
      checkedCount: checkedUserIds.length,
      totalCount: allMembers.length,
    });
  } catch (error) {
    console.error("Kiosk QR/Personal check error:", error);
    return NextResponse.json({ error: "Yoklama bilgileri alınırken hata oluştu." }, { status: 500 });
  }
}