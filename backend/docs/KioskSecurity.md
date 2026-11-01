## 1. Dosyanın Amacı ve Mimari Rolü

`kioskSecurity.js`, oda kapılarındaki tabletlerde gösterilen dinamik QR kodlarının ve öğrencilerin mobil cihazlarından verdikleri yoklama onaylarının **fiziksel ve kriptografik güvenliğini** yönetir. Öğrencilerin odaya gelmeden uzaktan yoklama vermesini (proxy attendance), ekran görüntüsü paylaşımını ve kampüs Eduroam Wi-Fi ağındaki IP çakışmalarını engelleyen 4 katmanlı bir savunma hattı sunar.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Kriptografi:** Node.js yerleşik `crypto` modülü (`createHmac`, `randomBytes`, `timingSafeEqual`, `createHash`).
- **Önbellek & Donanım Kilidi:** `@/lib/redis` (Dinamik token TTL'leri ve `kiosk:devlock` anahtarları).
- **Çevre Değişkeni:** `process.env.KIOSK_SECRET_KEY` (HMAC imzalama gizli anahtarı).

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. 30 Saniyelik Dinamik QR Token Üretimi (`generateKioskToken`)
- Tablet ekranının her 30 saniyede bir tazelediği QR kod içeriğini üretir.
- **Yük:** `{ token: <randomHex>, timestamp: <epochMs>, roomId: <id>, signature: <hmacSha256> }`.
- İmza formülü: `HMAC_SHA256(roomId + ":" + timestamp, KIOSK_SECRET_KEY)`.

### B. Zaman ve İmza Doğrulaması (`verifyKioskSignature`)
- Mobil cihazdan gelen QR yükünün imzasını zamanlama saldırılarına karşı güvenli (`timingSafeEqual`) yöntemle test eder.
- Zaman damgasının güncel olduğunu denetler (`Math.abs(now - timestamp) <= 30000ms`). 30 saniyeden eski ekran görüntüleri doğrudan reddedilir.

### C. Tek Kullanımlık Token Tüketimi ve Anti-Replay (`consumeKioskToken`)
- QR kod telefona okutulduğu anda Redis üzerinde `SET kiosk:token:<token> 1 EX 60 NX` komutu işletilir.
- Aynı token ikinci kez gönderilirse sistem `"Bu QR kod zaten kullanıldı veya süresi doldu"` hatası verir.

### D. Eduroam Wi-Fi Uyumlu Cihaz Kilidi (`enforceDeviceCheckinLock`)
- **Kampüs Wi-Fi NAT Çözümü:** Kampüsteki tüm öğrenciler aynı dış IP adresini paylaşır ve benzer telefon modelleri (ör. iPhone Safari) aynı User-Agent'ı üretir.
- Eski IP+UA kilitlerinin aynı sınıftaki farklı öğrenci## 2. `backend/docs/KioskSecurity.md`

```markdown
# Context: kioskSecurity.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/kioskSecurity.js`, Kiosk kapı QR yoklama sisteminin **4 katmanlı fiziksel, ağ ve donanım güvenliğini** sağlayan merkezi güvenlik servisidir. Öğrencilerin kütüphaneye gelmeden uzaktan yoklama vermesini, mobil veri/VPN kullanmasını veya tek bir telefondan gizli sekme (Incognito) açarak gelmeyen arkadaşları yerine sahte yoklama vermesini engeller.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Kriptografi:** Node.js yerleşik `crypto` modülü (`createHash("sha256")`)
- **Önbellek & Cihaz Kilitleri:** `@/lib/redis` (`ioredis`)
- **Ağ Doğrulama:** `ip-api.com` ISP/Mobil/Proxy/VPN sorgusu ve THKÜ/ULAKNET IP alt ağ doğrulaması
- **Sabitler:**
  - `LIBRARY_LAT` (`39.9458257845895`) & `LIBRARY_LNG` (`32.69035341292343`)
  - `MAX_DISTANCE_METERS` (`1000` metre)
  - `DEVICE_LOCK_TTL` (`14400` saniye / 4 saat)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Gizli Sekme Korumalı Donanım İmzası (`getCrossIncognitoSignature(request)`)
İstemciden gelen `x-forwarded-for` / `x-real-ip`, `user-agent`, `x-hardware-fp` (WebGL GPU donanım parmak izi), `x-device-id` ve `x-net-type` başlıklarını okur:
- **Kampüs Wi-Fi (Eduroam) NAT Uyumluluğu:** Aynı kampüs Wi-Fi IP'sini paylaşan ve aynı model telefon kullanan iki farklı öğrencinin birbirini kilitlememesi için yalın `IP+UA` kilidi kullanılmaz; yalnızca gerçek `x-hardware-fp` geldiğinde `sha256(ip|hwFp|ua)` ile 20 karakterlik `hwLockHash` üretilir.

### B. 1 KM Haversine GPS Mesafe Hesabı (`calculateDistanceMeters(lat1, lon1)`)
Öğrencinin tarayıcı GPS koordinatları ile THKÜ Türkkuşu Kampüsü Kütüphane koordinatları arasındaki kuş uçuşu mesafeyi Haversine formülüyle metre cinsinden hesaplar.

### C. Kampüs Wi-Fi (`eduroam`), Mobil Veri ve Anti-VPN Denetimi (`verifyCampusNetworkAndVpn(ip, netType)`)
1. `netType === "cellular"` ise (hücresel veri açıksa) anında reddeder.
2. IP adresi kampüs VPN bloğundaysa (`10.254.x.x`) reddeder.
3. `ENFORCE_CAMPUS_WIFI === "true"` olduğunda istemci IP'sinin THKÜ yerel Wi-Fi (`10.2.x.x`) veya resmi ULAKNET/THKÜ dış IP bloklarıyla (`212.154.67.x`, `95.183.206.x`, `193.255.x.x`) eşleşip eşleşmediğini ve `ip-api.com` üzerinden mobil/proxy/hosting olup olmadığını denetler.

### D. Cihaz Kilidi Denetimi ve Mühürleme (`checkDeviceLockForReservation` & `sealDeviceLockForReservation`)
- `thku_checkin_lock_${reservationId}` (`httpOnly` çerez), `kiosk:device_lock:${reservationId}:${headerDeviceId}` ve `kiosk:hw_lock:${reservationId}:${hwLockHash}` anahtarlarını Redis'te kontrol eder.
- Eğer bu fiziksel cihazdan aynı randevu için başka bir `userId` onay vermişse `isLockedByAnotherUser: true` döndürerek işlemi bloklar.
- Onay başarılı olduğunda `sealDeviceLockForReservation` ile cihazı 4 saat boyunca (`14400` sn) ilgili öğrenciye mühürler.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `frontend/src/api.js`leri bloklamasını önlemek için kilit, tarayıcıya bırakılan benzersiz çerez (`kiosk_device_token`), `x-device-id` başlığı ve donanım parmak izinin (`x-hardware-fp`) birleşimiyle üretilen `hwLockHash` üzerinden çalışır.
- Bir öğrenci kapıda QR okuttuğunda ilgili cihaz rezervasyon süresi boyunca kilitlenir; aynı telefondan başka bir öğrenci adına yoklama verilemez.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/kiosk/qr/route.js` (Tablet uç noktası)
- `backend/src/app/api/checkin/validate/route.js` (Mobil doğrulama uç noktası)
- `backend/src/lib/redis.js`