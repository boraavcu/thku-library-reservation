# Context: kioskSecurity.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/kioskSecurity.js`, Kiosk kapı QR yoklama sisteminin **4 katmanlı fiziksel, ağ ve donanım güvenliğini** sağlayan merkezi güvenlik servisidir. Öğrencilerin kütüphaneye gelmeden uzaktan yoklama vermesini, mobil veri/VPN kullanmasını veya tek bir telefondan gizli sekme (Incognito) ya da farklı bir tarayıcı açarak gelmeyen arkadaşları yerine sahte yoklama vermesini engeller.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Kriptografi:** Node.js yerleşik `crypto` modülü (`createHash("sha256")`)
- **Önbellek & Cihaz Kilitleri:** `@/lib/redis` (`ioredis`)
- **Ağ Doğrulama:** `ip-api.com` ISP/Mobil/Proxy/VPN sorgusu ve THKÜ/ULAKNET IP alt ağ doğrulaması
- **Sabitler:**
  - `LIBRARY_LAT` (`39.9458257845895`) & `LIBRARY_LNG` (`32.69035341292343`)
  - `MAX_DISTANCE_METERS` (`1000` metre)
  - `DEVICE_LOCK_TTL` (`14400` saniye / 4 saat)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. İstemci IP Normalizasyonu (`getClientIp(request)`)
- `x-forwarded-for` ve `x-real-ip` başlıklarından istemci IP adresini okur.
- IPv6/IPv4 localhost gösterimlerini (`::1`, `0:0:0:0:0:0:0:1`, `::ffff:127.0.0.1`) ve `::ffff:` önekli IPv4 adreslerini normalize eder.

### B. Gizli Sekme Korumalı Donanım ve Tarayıcı İmzası (`getCrossIncognitoSignature(request)`)
İstemciden gelen `ip`, `user-agent`, `x-hardware-fp` (WebGL GPU donanım parmak izi), `x-device-id` ve `x-net-type` başlıklarını okur. Gizli sekmede (Incognito) `Cookie` ve `localStorage` (`x-device-id`) sıfırlandığı için gizli sekme kilitleri kesinlikle `localStorage`'dan bağımsız iki ayrı özet (hash) üretir:
1. **`hwLockHash` (`sha256(ip|hwFp)`):** IP adresi ile WebGL GPU/Ekran/CPU donanım parmak izini birleştirir. Aynı cihazda açılan gizli sekmeleri ve farklı tarayıcıları (Chrome -> Edge/Safari) yakalar.
2. **`ipUaLockHash` (`sha256(ip|ua)`):** IP adresi ile tarayıcı `User-Agent` bilgisini birleştirir. Gizli sekmede WebGL bilgisi tarayıcı tarafından kısıtlansa bile aynı cihazdaki gizli sekmeyi %100 yakalar.

### C. 1 KM Haversine GPS Mesafe Hesabı (`calculateDistanceMeters(lat1, lon1)`)
Öğrencinin tarayıcı GPS koordinatları ile THKÜ Türkkuşu Kampüsü Kütüphane koordinatları arasındaki kuş uçuşu mesafeyi Haversine formülüyle metre cinsinden hesaplar.

### D. Kampüs Wi-Fi (`eduroam`), Mobil Veri ve Anti-VPN Denetimi (`verifyCampusNetworkAndVpn(ip, netType)`)
1. `netType === "cellular"` ise (hücresel veri açıksa) anında reddeder.
2. IP adresi kampüs VPN bloğundaysa (`10.254.x.x`) reddeder.
3. `ENFORCE_CAMPUS_WIFI === "true"` olduğunda istemci IP'sinin THKÜ yerel Wi-Fi (`10.2.x.x`) veya resmi ULAKNET/THKÜ dış IP bloklarıyla (`212.154.67.x`, `95.183.206.x`, `193.255.x.x`) eşleşip eşleşmediğini ve `ip-api.com` üzerinden mobil/proxy/hosting olup olmadığını denetler (yerel ağda `429` rate-limit toleransı ile).

### E. 4 Katmanlı Cihaz Kilidi Denetimi ve Mühürleme (`checkDeviceLockForReservation` & `sealDeviceLockForReservation`)
- `thku_checkin_lock_${reservationId}` (`httpOnly` çerez), `kiosk:device_lock:${reservationId}:${headerDeviceId}`, `kiosk:hw_lock:${reservationId}:${hwLockHash}` ve `kiosk:ipua_lock:${reservationId}:${ipUaLockHash}` anahtarlarını paralel (`Promise.all`) kontrol eder.
- Bu 4 kilitten **herhangi biri** `currentUserId` dışında başka bir öğrenciye (`conflictingOwner`) aitse `isLockedByAnotherUser: true` döndürerek işlemi anında bloklar.
- Onay başarılı olduğunda (veya daha önce onay vermiş öğrenci Kiosk ekranını açtığında) `sealDeviceLockForReservation` ile `deviceKey`, `hwKey` ve `ipUaKey` anahtarlarını Redis'te 4 saat boyunca (`14400` sn) ilgili öğrenciye mühürler.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `frontend/src/api.js`
- `backend/src/lib/redis.js`
