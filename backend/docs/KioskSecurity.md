# Context: kioskSecurity.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/kioskSecurity.js`, Kiosk kapı QR yoklama sisteminin **fiziksel konum, kampüs ağı (`eduroam`) ve donanım/tarayıcı imzası güvenliğini** sağlayan merkezi güvenlik servisidir. Öğrencilerin kütüphaneye gelmeden uzaktan yoklama vermesini, mobil veri/VPN kullanmasını veya tek bir telefondan gizli sekme (Incognito) ya da farklı bir tarayıcı açarak gelmeyen arkadaşları yerine sahte yoklama vermesini engellerken, kampüs Wi-Fi NAT paylaşımında farklı telefonların yanlışlıkla birbirini kilitlemesini önler.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Kriptografi:** Node.js yerleşik `crypto` modülü (`createHash("sha256")`)
- **Veritabanı Kilit ve Varlık Katmanı:** `./kioskStore.js` (`readKioskPresence` — PostgreSQL `kiosk_device_locks` & `kiosk_attendances`)
- **Ağ Doğrulama:** `ip-api.com` ISP/Mobil/Proxy/VPN sorgusu ve THKÜ/ULAKNET IP alt ağ doğrulaması
- **Sabitler:**
  - `LIBRARY_LAT` (`39.9458257845895`) & `LIBRARY_LNG` (`32.69035341292343`)
  - `MAX_DISTANCE_METERS` (`1000` metre — `LIBRARY_RADIUS_METERS` ile yapılandırılabilir)
  - `DEVICE_LOCK_TTL` (`14400` saniye / 4 saat)
  - Sahte imza süzgeçleri: `DUMMY_DEVICE_IDS` (`""`, `"no-dev-id"`, `"dev_fallback_browser"`, `"undefined"`, `"null"`) ve `DUMMY_HW_FPS` (`""`, `"no-hw"`, `"hw_fallback"`, `"undefined"`, `"null"`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. İstemci IP Normalizasyonu ve Cihaz ID Temizliği (`getClientIp`, `sanitizeDeviceId`)
- **`getClientIp(request)`:** `x-forwarded-for` ve `x-real-ip` başlıklarından istemci IP adresini okur; IPv6/IPv4 localhost gösterimlerini ve `::ffff:` öneklerini normalize eder.
- **`sanitizeDeviceId(rawDeviceId)`:** `DUMMY_DEVICE_IDS` kümesindeki sahte/varsayılan değerleri boş dizgeye (`""`) çevirerek paylaşılan sahte kilit oluşmasını engeller.

### B. Kampüs NAT Uyumlu Gizli Sekme ve Donanım İmzası (`getCrossIncognitoSignature(request)`)
İstemciden gelen `ip`, `user-agent`, `x-hardware-fp`, `x-device-id` ve `x-net-type` başlıklarını okur:
- `hasValidHw = !DUMMY_HW_FPS.has(rawHwFp)` kontrolü ile donanım parmak izinin gerçek olup olmadığını denetler.
- **NAT Yanlış Pozitif Koruması:** Kampüs Wi-Fi (`eduroam`) arkasında yüzlerce öğrenci aynı dış IP ve benzer `User-Agent` paylaştığı için, `hwLockHash` (`sha256(ip|rawHwFp|ua)` ilk 24 karakter) ve `ipUaLockHash` (`sha256(ip|ua|rawHwFp)` ilk 24 karakter) **yalnızca geçerli donanım parmak izi (`hasValidHw === true`) varsa** üretilir. Böylece farklı telefonlar birbirini kilitlemez, ancak aynı telefondan açılan gizli sekme (Incognito) %100 yakalanır.

### C. Kilit Dizisi Oluşturucu (`buildKioskLocksForRequest(request, reservationId, signature)`)
- `thku_kiosk_dev_${reservationId}` çerezi veya `signature.headerDeviceId` üzerinden `DEVICE`, geçerli donanım özetleri üzerinden `HARDWARE` ve `IP_UA` kilit nesnelerini (`{ type, key }`) hazırlar.

### D. 1 KM Haversine GPS Mesafe ve Kampüs Wi-Fi Denetimi (`calculateDistanceMeters`, `verifyCampusNetworkAndVpn`)
1. **`calculateDistanceMeters`:** Öğrencinin koordinatları ile kütüphane binası arasındaki kuş uçuşu mesafeyi Haversine formülüyle metre cinsinden hesaplar.
2. **`verifyCampusNetworkAndVpn(ip, netType)`:**
   - `netType === "cellular"` ise (hücresel veri) ve IP kampüs VPN bloğundaysa (`10.254.x.x`) anında reddeder.
   - `ENFORCE_CAMPUS_WIFI === "true"` olduğunda THKÜ yerel Wi-Fi (`10.2.x.x`) ve resmi ULAKNET/THKÜ dış IP bloklarını (`212.154.67.`, `95.183.206.`, `193.255.`) doğrular; dış IP'lerde `ip-api.com` üzerinden mobil/proxy/hosting kontrolü yapar.

### E. PostgreSQL Cihaz Kilidi ve Varlık Denetimi (`checkDeviceLockForReservation`)
- Tarayıcıdaki `thku_checkin_lock_${reservationId}` (`httpOnly` çerez) değerini okur ve `readKioskPresence` ile PostgreSQL `kiosk_device_locks` (`DEVICE`, `HARDWARE`, `IP_UA`) sahiplerini ve `kiosk_attendances` yoklama listesini çeker.
- Bu kilitlerden herhangi biri `currentUserId` dışında başka bir kullanıcıya aitse `isLockedByAnotherUser: true` döndürür; ayrıca `presence: { owners, checkedUserIds }`, `locks` ve `cookieName` bilgilerini üst katmana iletir.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/kioskStore.js`
- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/test/kiosk-atomicity.mjs`
- `frontend/src/api.js`
