import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";
import redis from "@/lib/redis";
import crypto from "crypto";
import os from "os";
import { runReservationLifecycleChecks, getReservationKioskWindow } from "@/lib/lifecycle";

const PERSONAL_OTP_TTL = 600;
const DEFAULT_TOLERANCE_MINUTES = 15;

// THKÜ Türkkuşu Kampüsü Kütüphane Koordinatları (1 KM Sabit Yarıçap)
const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 39.9458257845895);
const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 32.69035341292343);
const MAX_DISTANCE_METERS = Number(process.env.LIBRARY_RADIUS_METERS || 1000);

// THKÜ eduroam & THKU-802.1x Resmi IP Blokları
const THKU_PUBLIC_PREFIXES = ["212.154.67.", "95.183.206.", "193.255."];
const THKU_LOCAL_WIFI_PREFIX = "10.2.";

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

function hasCampusLocalWifiInterface() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal && net.address.startsWith(THKU_LOCAL_WIFI_PREFIX)) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
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

async function verifyCampusNetworkAndVpn(ip, netType) {
  if (netType === "cellular") {
    return {
      allowed: false,
      reason: "Mobil Veri (Hücresel Ağ) bağlantısı tespit edildi. Oda giriş onayı yalnızca THKÜ Kampüs Wi-Fi (eduroam / THKU-802.1x) ağı üzerinden yapılabilir.",
    };
  }

  const vpnPrefix = process.env.CAMPUS_VPN_PREFIX || "10.254.";
  if (ip.startsWith(vpnPrefix)) {
    return {
      allowed: false,
      reason: "Güvenlik İhlali: Kampüs VPN bağlantısı üzerinden uzaktan kapı QR doğrulaması yapılamaz.",
    };
  }

  if (process.env.ENFORCE_CAMPUS_WIFI === "true") {
    const customPrefix = process.env.CAMPUS_IP_PREFIX;
    const validPublicPrefixes = customPrefix
      ? [customPrefix, ...THKU_PUBLIC_PREFIXES]
      : THKU_PUBLIC_PREFIXES;

    if (
      ip.startsWith(THKU_LOCAL_WIFI_PREFIX) ||
      validPublicPrefixes.some((pref) => ip.startsWith(pref))
    ) {
      return { allowed: true };
    }

    try {
      const targetQueryIp =
        ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")
          ? ""
          : ip;

      const res = await fetch(
        `http://ip-api.com/json/${targetQueryIp}?fields=status,query,isp,org,mobile,proxy,hosting`,
        { signal: AbortSignal.timeout(3000) }
      );
      const netInfo = await res.json();

      if (netInfo?.status === "success") {
        if (netInfo.mobile) {
          return {
            allowed: false,
            reason: `Mobil Veri / Kişisel Erişim Noktası (${netInfo.isp}) tespit edildi! Lütfen mobil verinizi kapatıp THKÜ Kampüs Wi-Fi (eduroam / THKU-802.1x) ağına bağlanınız.`,
          };
        }

        if (netInfo.proxy || netInfo.hosting) {
          return {
            allowed: false,
            reason: `Güvenlik İhlali: VPN veya Proxy bağlantısı (${netInfo.isp}) tespit edildi. Kütüphane dışından onay verilemez.`,
          };
        }

        const publicIpMatches = validPublicPrefixes.some(
          (pref) => netInfo.query && netInfo.query.startsWith(pref)
        );
        const orgMatches = /ulaknet|thk|türk hava kurumu|eduroam/i.test(
          `${netInfo.isp} ${netInfo.org}`
        );
        const localWifiMatches = hasCampusLocalWifiInterface();

        if (!publicIpMatches && !orgMatches && !localWifiMatches) {
          return {
            allowed: false,
            reason: `Kampüs Wi-Fi (eduroam / THKU-802.1x) ağında değilsiniz (Dış IP: ${netInfo.query} - İSS: ${netInfo.isp}). Yalnızca THKÜ kampüs ağından onay verilebilir.`,
          };
        }

        return { allowed: true };
      }
    } catch {
      if (hasCampusLocalWifiInterface()) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "Kampüs Wi-Fi (eduroam / THKU-802.1x) ağı doğrulanamadı.",
      };
    }
  }

  return { allowed: true };
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
    await runReservationLifecycleChecks();

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

    const { searchParams } = new URL(request.url);
    const doorParam = searchParams.get("door");

    if (doorParam !== "thku-study-room") {
      return NextResponse.json({
        mode: "DOOR_QR_REQUIRED",
        error:
          "Yoklama ekranına anasayfadan veya doğrudan linkle girilemez. Lütfen çalışma odasının kapısındaki fiziksel QR kodu telefon kameranızla okutunuz.",
      });
    }

    const { ip, hwLockHash, ipUaHash, headerDeviceId, netType } = getCrossIncognitoSignature(request);

    const networkCheck = await verifyCampusNetworkAndVpn(ip, netType);
    if (!networkCheck.allowed) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error: networkCheck.reason,
      });
    }

    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const enforceGps = process.env.ENFORCE_CAMPUS_GPS !== "false";

    let distanceMeters = null;
    if (latParam !== null && lngParam !== null) {
      const userLat = parseFloat(latParam);
      const userLng = parseFloat(lngParam);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        distanceMeters = calculateDistanceMeters(userLat, userLng, LIBRARY_LAT, LIBRARY_LNG);
        if (enforceGps && distanceMeters > MAX_DISTANCE_METERS) {
          return NextResponse.json({
            mode: "LOCATION_BLOCKED",
            error: `Fiziksel Konum Hatası: Kütüphane binasına ${distanceMeters} metre uzaklıktasınız (Maksimum sınır: ${MAX_DISTANCE_METERS}m). Kütüphane dışından onay verilemez.`,
          });
        }
      }
    } else if (enforceGps) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error: "Oda girişini onaylayabilmek için tarayıcınızın Konum (GPS) iznini açmanız zorunludur.",
      });
    }

    const tolRule = await prisma.reservationRule.findFirst({
      where: { ruleName: "CHECKIN_TOLERANCE_MINUTES", isActive: true },
      select: { ruleValue: true },
    });
    const toleranceMinutes = Number(tolRule?.ruleValue?.value ?? DEFAULT_TOLERANCE_MINUTES);

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
        error: "Bugün için onaylanmış aktif bir çalışma odası randevunuz bulunmamaktadır (veya ±15 dk yoklama süresi dolduğu için otomatik iptal edilmiştir).",
      });
    }

    let matchedReservation = null;
    let windowInfoError = null;
    let activeWindowLabel = "";

    for (const r of todayReservations) {
      const { startTotalMins, minAllowed, maxAllowed } = getReservationKioskWindow(
        r,
        todayStr,
        toleranceMinutes
      );

      if (nowMins >= minAllowed && nowMins <= maxAllowed) {
        matchedReservation = r;
        activeWindowLabel = `${fmtMinsToTime(minAllowed)} – ${fmtMinsToTime(maxAllowed)}`;
        break;
      } else {
        windowInfoError = `${r.room.roomNumber} - ${r.room.name} odasındaki ${fmtMinsToTime(
          startTotalMins
        )} randevunuz için kapı QR onayı yalnızca ${fmtMinsToTime(
          minAllowed
        )} – ${fmtMinsToTime(maxAllowed)} saatleri arasında yapılabilir. Şu anki saat: ${fmtMinsToTime(nowMins)}`;
      }
    }

    if (!matchedReservation) {
      return NextResponse.json({
        mode: "OUTSIDE_TIME_WINDOW",
        error:
          windowInfoError ||
          `Şu anki saat, randevunuzun ±${toleranceMinutes} dakikalık başlangıç onay penceresi dışındadır.`,
      });
    }

    const cookieName = `thku_checkin_lock_${matchedReservation.id}`;
    const cookieOwner = request.cookies.get(cookieName)?.value;
    const devOwner = await redis.get(`kiosk:device_lock:${matchedReservation.id}:${headerDeviceId}`);
    const hwOwner = await redis.get(`kiosk:hw_lock:${matchedReservation.id}:${hwLockHash}`);
    const ipUaOwner = await redis.get(`kiosk:ipua_lock:${matchedReservation.id}:${ipUaHash}`);

    const existingOwner = cookieOwner || devOwner || hwOwner || ipUaOwner;
    if (existingOwner && existingOwner !== userId) {
      return NextResponse.json({
        mode: "LOCATION_BLOCKED",
        error:
          "⛔ Güvenlik İhlali (Gizli Sekme / Aynı Cihaz Algılandı): Bu fiziksel cihazdan bu randevu için zaten başka bir öğrenci onay vermiştir. Her katılımcı kendi mobil cihazından QR okutmak zorundadır!",
      });
    }

    const checkedSetKey = `kiosk:checked_users:${matchedReservation.id}`;
    const checkedUserIds = await redis.smembers(checkedSetKey);
    const alreadyCheckedIn = checkedUserIds.includes(userId);

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
      windowLabel: activeWindowLabel,
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