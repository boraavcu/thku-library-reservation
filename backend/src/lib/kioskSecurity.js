import crypto from "crypto";
import redis from "@/lib/redis";

export const LIBRARY_LAT = Number(process.env.LIBRARY_LAT || 39.9458257845895);
export const LIBRARY_LNG = Number(process.env.LIBRARY_LNG || 32.69035341292343);
export const MAX_DISTANCE_METERS = Number(process.env.LIBRARY_RADIUS_METERS || 1000);
export const DEVICE_LOCK_TTL = 14400; // 4 Saat

const THKU_PUBLIC_PREFIXES = ["212.154.67.", "95.183.206.", "193.255."];
const THKU_LOCAL_WIFI_PREFIX = "10.2.";

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

export function getCrossIncognitoSignature(request) {
  const ip = getClientIp(request);
  const ua = request.headers.get("user-agent") || "no-ua";
  const hwFp = request.headers.get("x-hardware-fp") || "no-hw";
  const netType = request.headers.get("x-net-type") || "unknown";
  const headerDeviceId = request.headers.get("x-device-id") || "no-dev-id";

  // Gizli sekmede (Incognito) cookie ve localStorage (x-device-id) sıfırlanır.
  // Bu nedenle gizli sekme kilitleri kesinlikle localStorage'a (x-device-id) bağlı OLMAMALIDIR:
  // 1) hwLockHash: IP + Donanım Parmak İzi (GPU/Ekran/CPU) -> Gizli sekmeyi ve aynı cihazdaki farklı tarayıcıları yakalar.
  const hwLockHash =
    hwFp !== "no-hw"
      ? crypto
          .createHash("sha256")
          .update(`${ip}|${hwFp}`)
          .digest("hex")
          .substring(0, 24)
      : null;

  // 2) ipUaLockHash: IP + User-Agent -> Gizli sekmede WebGL kısıtlansa bile aynı cihazdaki tarayıcıyı %100 yakalar.
  const ipUaLockHash = crypto
    .createHash("sha256")
    .update(`${ip}|${ua}`)
    .digest("hex")
    .substring(0, 24);

  return {
    ip,
    hwLockHash,
    ipUaLockHash,
    headerDeviceId: headerDeviceId !== "no-dev-id" ? headerDeviceId : null,
    netType,
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

      // Rate-limit (429) durumunda yerel geliştirme/kampüs iç ağında bloklama yapma
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
  const cookieOwner = request.cookies.get(cookieName)?.value || null;

  const deviceKey = signature.headerDeviceId
    ? `kiosk:device_lock:${reservationId}:${signature.headerDeviceId}`
    : null;
  const hwKey = signature.hwLockHash
    ? `kiosk:hw_lock:${reservationId}:${signature.hwLockHash}`
    : null;
  const ipUaKey = signature.ipUaLockHash
    ? `kiosk:ipua_lock:${reservationId}:${signature.ipUaLockHash}`
    : null;

  const [deviceOwner, hwOwner, ipUaOwner] = await Promise.all([
    deviceKey ? redis.get(deviceKey) : Promise.resolve(null),
    hwKey ? redis.get(hwKey) : Promise.resolve(null),
    ipUaKey ? redis.get(ipUaKey) : Promise.resolve(null),
  ]);

  const conflictingOwner = [cookieOwner, deviceOwner, hwOwner, ipUaOwner].find(
    (owner) => owner && owner !== currentUserId
  );
  const lockedOwner = conflictingOwner || cookieOwner || deviceOwner || hwOwner || ipUaOwner || null;
  const isLockedByAnotherUser = Boolean(conflictingOwner);

  return {
    isLockedByAnotherUser,
    lockedOwner,
    cookieName,
    keys: { deviceKey, hwKey, ipUaKey },
  };
}

export async function sealDeviceLockForReservation(keys, userId) {
  const ops = [];
  if (keys.deviceKey) {
    ops.push(redis.set(keys.deviceKey, userId, "EX", DEVICE_LOCK_TTL));
  }
  if (keys.hwKey) {
    ops.push(redis.set(keys.hwKey, userId, "EX", DEVICE_LOCK_TTL));
  }
  if (keys.ipUaKey) {
    ops.push(redis.set(keys.ipUaKey, userId, "EX", DEVICE_LOCK_TTL));
  }
  if (ops.length > 0) {
    await Promise.all(ops);
  }
}
