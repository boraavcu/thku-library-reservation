# Context: kiosk/qr/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/kiosk/qr/route.js`, Kiosk kapı yoklama ekranının (`Kiosk.jsx`) ön doğrulama ve durum sorgulama uç noktasıdır (`GET`). Yetkililer için `/randevu/kiosk` tabanlı A4 Kapı QR Posteri bilgisini döndürürken, öğrenciler için `@/lib/kioskSecurity` ve PostgreSQL tabanlı `@/lib/kioskStore` üzerinden **fiziksel/ağ güvenlik denetimini** ve **±15 dakikalık Kiosk onay penceresi kontrolünü** gerçekleştirerek tek kullanımlık kişisel doğrulama kodu (`personalSessionToken`) üretir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Alt Dizin URL Yardımcısı:** `@/lib/publicPaths` (`getFrontendBaseUrl`)
- **PostgreSQL Kiosk Katmanı:** `@/lib/kioskStore` (`createPrismaDb`, `issuePersonalCodeForReservation`, `listAttendanceUserIds`)
- **Fiziksel & Ağ Güvenliği:** `@/lib/kioskSecurity` (`getCrossIncognitoSignature`, `verifyCampusNetworkAndVpn`, `calculateDistanceMeters`, `checkDeviceLockForReservation`, `MAX_DISTANCE_METERS`)
- **Zaman & Yaşam Döngüsü:** `@/lib/timeUtils` & `@/lib/lifecycle` (`runReservationLifecycleChecks`)

## 3. Çekirdek İş Mantığı ve Güvenlik Katmanları (`GET`)

1. **Oturum ve Şifre Kapısı:** `rejectIfPasswordChangeRequired(session)` ile geçici şifre oturumları (`403`) ve oturumsuz istekler (`401`) reddedilir; ardından `runReservationLifecycleChecks()` çalıştırılır.
2. **Görevli Poster Modu (`STAFF_POSTER`):** Kullanıcı `LIBRARIAN`, `ADMIN` veya `SUPER_ADMIN` ise `getFrontendBaseUrl()` üzerinden `${frontendUrl}/kiosk?door=thku-study-room` (`/randevu/kiosk?door=thku-study-room`) bağlantısını ve `ttlSeconds: 600` bilgisini döndürür.
3. **4 Katmanlı Öğrenci Fiziksel ve Cihaz Denetimi:**
   - **Kapı QR Parametresi:** `door !== "thku-study-room"` ise `mode: "DOOR_QR_REQUIRED"` döndürülür.
   - **Kampüs Wi-Fi (`eduroam`) ve Anti-VPN:** `verifyCampusNetworkAndVpn` hücresel veriyi (`cellular`) ve VPN IP bloklarını engeller (`mode: "LOCATION_BLOCKED"`).
   - **Opsiyonel/Zorunlu GPS Mesafe Denetimi (`ENFORCE_CAMPUS_GPS === "true"`):** Koordinatlar verilmişse Haversine mesafesi hesaplanır; `ENFORCE_CAMPUS_GPS === "true"` iken konum izni kapalıysa veya mesafe `MAX_DISTANCE_METERS` (`1000` m) sınırını aşıyorsa `mode: "LOCATION_BLOCKED"` döner.
   - **PostgreSQL Cihaz Kilidi (`checkDeviceLockForReservation`):** Tarayıcı çerezi ve `kiosk_device_locks` tablosu üzerinden bu fiziksel cihazın aynı randevuda başka bir öğrenci tarafından kullanılıp kullanılmadığı kontrol edilir (`isLockedByAnotherUser`).
4. **3 Günlük Aday Penceresi ve Kişisel Kod Üretimi (`issuePersonalCodeForReservation`):**
   - Gece yarısı geçişlerini kapsamak için `[yesterdayDate, todayDate, tomorrowDate]` tarihlerindeki `CONFIRMED` ve `CHECKED_IN` randevular taranır; hem başlangıç tolerans penceresindeki hem de zaten `CHECKED_IN` olmuş aktif odalardaki öğrenciler kabul edilir.
   - `presence.checkedUserIds` içinde bulunmayan öğrenci için PostgreSQL `kiosk_check_in_codes` tablosunda `FOR UPDATE` satır kilidiyle 600 saniye geçerli tek kullanımlık `personalSessionToken` üretilir ve `mode: "STUDENT_ACTIVE"` yanıtıyla grup üyelerinin anlık yoklama listesi (`members`) döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Kiosk.jsx`
- `backend/src/lib/kioskStore.js` & `backend/src/lib/kioskSecurity.js`
- `backend/src/lib/publicPaths.js` & `backend/src/lib/passwordGate.js`
- `backend/src/app/api/checkin/validate/route.js`
