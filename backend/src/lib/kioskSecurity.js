import crypto from "crypto";
import { readKioskPresence } from "./kioskStore.js";

export const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 39.9458257845895);
export const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 32.69035341292343);
export const MAX_DISTANCE_METERS = Number(process.env.LIBRARY_RADIUS_METERS || 1000);
export const DEVICE_LOCK_TTL = 14400; // 4 Saat

const THKU_PUBLIC_PREFIXES = ["212.154.67.", "95.183.206.", "193.255."];
const THKU_LOCAL_WIFI_PREFIX = "10.2.";

const DUMMY_DEVICE_IDS = new Set(["", "no-dev-id", "dev_fallback_browser", "undefined", "null"]);
const DUMMY_HW_FPS = new Set(["", "no-hw", "hw_fallback", "undefined", "null"]);

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const rawIp = forwarded
    ? forwarded.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "127.0.0.1";

  if (rawIp === "::1" || rawIp === "0:0:0:0:0:0:0:1" || rawIp === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }
  if (rawIp.startsWith("::ffff:")) {
    return rawIp.substring(7);
  }
  return rawIp;
}

export function sanitizeDeviceId(rawDeviceId) {
  const cleaned = String(rawDeviceId || "").trim();
  return DUMMY_DEVICE_IDS.has(cleaned) ? "" : cleaned;
}

export function getCrossIncognitoSignature(request) {
  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent") || "no-ua";
  const rawHwFp = String(request.headers.get("x-hardware-fp") || "").trim();
  const netType = request.headers.get("x-net-type") || "unknown";
  const headerDeviceId = sanitizeDeviceId(request.headers.get("x-device-id"));

  const hasValidHw = !DUMMY_HW_FPS.has(rawHwFp);

  // 1) hwLockHash: IP + Donanım Parmak İzi (GPU/Ekran/CPU) + User-Agent
  // Gizli sekmeyi (Incognito) %100 yakalar, aynı kampüs Wi-Fi (NAT) üzerindeki farklı telefonların çakışmasını önler.
  const hwLockHash = hasValidHw
    ? crypto
        .createHash("sha256")
        .update(`${ip}|${rawHwFp}|${ua}`)
        .digest("hex")
        .substring(0, 24)
    : "";

  // 2) ipUaLockHash: Kampüs Wi-Fi NAT (eduroam) arkasında salt IP + User-Agent çakışmasını
  // önlemek için yalnızca geçerli donanım parmak izi varsa üretilir.
  const ipUaLockHash = hasValidHw
    ? crypto
        .createHash("sha256")
        .update(`${ip}|${ua}|${rawHwFp}`)
        .digest("hex")
        .substring(0, 24)
    : "";

  return {
    ip,
    ua,
    hwFp: hasValidHw ? rawHwFp : "",
    hwLockHash,
    ipUaLockHash,
    headerDeviceId: headerDeviceId || null,
    netType,
  };
}

export function buildKioskLocksForRequest(request, reservationId, signature) {
  const cookieDeviceId = sanitizeDeviceId(
    request.cookies?.get?.(`thku_kiosk_dev_${reservationId}`)?.value
  );
  const deviceKey = cookieDeviceId || signature.headerDeviceId || "";
  const hardwareKey = signature.hwLockHash || "";
  const ipUaKey = signature.ipUaLockHash || "";

  const locks = [];
  if (deviceKey) locks.push({ type: "DEVICE", key: deviceKey });
  if (hardwareKey) locks.push({ type: "HARDWARE", key: hardwareKey });
  if (ipUaKey) locks.push({ type: "IP_UA", key: ipUaKey });

  return {
    deviceKey,
    hardwareKey,
    ipUaKey,
    locks,
  };
}

export function calculateDistanceMeters(lat1, lon1, lat2 = LIBRARY_LAT, lon2 = LIBRARY_LNG) {
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

export async function verifyCampusNetworkAndVpn(ip, netType) {
  if (netType === "cellular") {
    return {
      allowed: false,
      reason:
        "Mobil Veri (Hücresel Ağ) bağlantısı tespit edildi. Oda giriş onayı yalnızca THKÜ Kampüs Wi-Fi (eduroam / THKU-802.1x) ağı üzerinden yapılabilir.",
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
      const isPrivateOrLocal =
        ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.");
      const targetQueryIp = isPrivateOrLocal ? "" : ip;

      const res = await fetch(
        `http://ip-api.com/json/${targetQueryIp}?fields=status,query,isp,org,mobile,proxy,hosting`,
        { signal: AbortSignal.timeout(3000) }
      );

      if (res.status === 429 && isPrivateOrLocal) {
        return { allowed: true };
      }

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

        if (!publicIpMatches && !orgMatches) {
          return {
            allowed: false,
            reason: `Kampüs Wi-Fi (eduroam / THKU-802.1x) ağında değilsiniz (Dış IP: ${netInfo.query} - İSS: ${netInfo.isp}). Yalnızca THKÜ kampüs ağından onay verilebilir.`,
          };
        }

        return { allowed: true };
      }
    } catch {
      return {
        allowed: false,
        reason: "Kampüs Wi-Fi (eduroam / THKU-802.1x) ağı doğrulanamadı.",
      };
    }
  }

  return { allowed: true };
}

export async function checkDeviceLockForReservation(request, reservationId, currentUserId, signature) {
  const cookieName = `thku_checkin_lock_${reservationId}`;
  const cookieOwner = request.cookies?.get?.(cookieName)?.value || null;

  const { deviceKey, hardwareKey, ipUaKey, locks } = buildKioskLocksForRequest(
    request,
    reservationId,
    signature
  );

  const { owners, checkedUserIds } = await readKioskPresence(reservationId, {
    deviceKey,
    hardwareKey,
    ipUaKey,
  });

  const conflictingOwner = [cookieOwner, owners.DEVICE, owners.HARDWARE, owners.IP_UA].find(
    (owner) => owner && owner !== currentUserId
  );
  const lockedOwner =
    conflictingOwner || cookieOwner || owners.DEVICE || owners.HARDWARE || owners.IP_UA || null;
  const isLockedByAnotherUser = Boolean(conflictingOwner);

  return {
    isLockedByAnotherUser,
    lockedOwner,
    cookieName,
    checkedUserIds,
    presence: { owners, checkedUserIds },
    locks,
    keys: { deviceKey, hwKey: hardwareKey, ipUaKey },
  };
}
