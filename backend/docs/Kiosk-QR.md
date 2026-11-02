# Context: kiosk/qr/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/kiosk/qr/route.js`, Kiosk kapı yoklama ekranının (`Kiosk.jsx`) ön doğrulama ve durum sorgulama uç noktasıdır (`GET`). Yetkililer için A4 Kapı QR Posteri bilgisini döndürürken, öğrenciler için `@/lib/kioskSecurity` üzerinden **4 katmanlı fiziksel/ağ güvenlik denetimini** ve **±15 dakikalık Kiosk onay penceresi kontrolünü** gerçekleştirerek tek kullanımlık kişisel oturum anahtarı (`personalSessionToken`) üretir.

##  2. 4 Katmanlı Güvenlik ve Ağ Doğrulama Mimarisi

Öğrencinin kütüphaneye gelmeden uzaktan veya arkadaşının telefonundan sahte onay vermesini engellemek için sırasıyla şu 4 katman denetlenir:

1. **Fiziksel Kapı QR Parametresi (`door === "thku-study-room"`):**
   - Öğrenci doğrudan menüden veya linkten `/kiosk` sayfasına girerse `mode: "DOOR_QR_REQUIRED"` döner ve giriş engellenir.
2. **Kampüs Wi-Fi (`eduroam` / `THKU-802.1x`), Hücresel Veri ve Anti-VPN Denetimi (`verifyCampusNetworkAndVpn`):**
   - `x-net-type === "cellular"` ise (mobil veri açıksa) anında reddedilir.
   - IP adresi kampüs VPN bloğundaysa (`10.254.x.x`) reddedilir.
   - `ENFORCE_CAMPUS_WIFI === "true"` olduğunda istemci IP'sinin THKÜ yerel Wi-Fi (`10.2.x.x`) veya resmi ULAKNET/THKÜ dış IP bloklarıyla eşleşip eşleşmediği ve `ip-api.com` üzerinden mobil/proxy/VPN olup olmadığı doğrulanır.
3. **1 KM Sabit GPS Mesafe Denetimi (`calculateDistanceMeters`):**
   - Haversine formülü ile öğrencinin GPS koordinatları (`lat`, `lng`) ile THKÜ Türkkuşu Kampüsü Kütüphane koordinatları arasındaki mesafe metre cinsinden hesaplanır. Mesafe `MAX_DISTANCE_METERS` (`1000` m) sınırından fazlaysa `mode: "LOCATION_BLOCKED"` döner.
4. **Gizli Sekme (Incognito) ve Aynı Cihaz Kilidi (`checkDeviceLockForReservation` & `sealDeviceLockForReservation`):**
   - İstemcinin `httpOnly` çerezi (`thku_checkin_lock_${resId}`), `x-device-id` başlığı (`kiosk:device_lock`), `IP + WebGL GPU` donanım imzası (`kiosk:hw_lock`) ve `IP + User-Agent` özeti (`kiosk:ipua_lock`) Redis'te kontrol edilir. Aynı fiziksel cihazdan bu randevu için başka bir öğrenci onay vermişse gizli sekme açılsa dahi işlem anında engellenir.
   - Daha önce onay vermiş bir öğrenci (`alreadyCheckedIn === true`) sayfayı açtığında da `sealDeviceLockForReservation(keys, userId)` çağrılarak tüm cihaz kilitlerinin Redis'te güncel kalması sağlanır.

##  3. Zaman Penceresi (`getReservationKioskWindow`) ve OTP Üretimi

- Gece yarısı sınır geçişlerini desteklemek için `[yesterdayDate, todayDate, tomorrowDate]` aralığındaki `CONFIRMED` ve `CHECKED_IN` randevular taranır.
- Şu anki dakika `minAllowed` ile `maxAllowed` arasındaysa Redis'te `kiosk:personal_otp:${reservationId}:${userId}` anahtarıyla 600 saniye geçerli tek kullanımlık `personalSessionToken` üretilir ve grup üyelerinin anlık yoklama durumuyla (`members`) birlikte `mode: "STUDENT_ACTIVE"` döndürülür.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Kiosk.jsx`
- `backend/src/lib/kioskSecurity.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/lib/lifecycle.js`
