# Context: checkin/validate/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/checkin/validate/route.js`, öğrencinin kapıdaki QR kodu okutup `Kiosk.jsx` ekranındaki **"Oda Girişimi Onayla (Check-In)"** butonuna bastığında çalışan nihai yoklama onay, PostgreSQL cihaz kilitleme ve oda açılış uç noktasıdır (`POST`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **PostgreSQL Atomik Check-In:** `@/lib/kioskStore` (`performCheckIn`)
- **Fiziksel Güvenlik & Çerez Yolu:** `@/lib/kioskSecurity` & `@/lib/publicPaths` (`getBrowserCookiePath`)
- **Yaşam Döngüsü & Bildirim:** `@/lib/lifecycle` (`runReservationLifecycleChecks`, `sendKioskCheckInEmailToStaff`) & `@/lib/timeUtils`

## 3. İş Mantığı, Atomik PostgreSQL Kilitleme ve 2. Kişi Onay Kuralı (`POST`)

1. **Şifre Kapısı, Ağ ve GPS Doğrulaması:**
   - `rejectIfPasswordChangeRequired(session)` ve oturum kontrolü yapılır.
   - `verifyCampusNetworkAndVpn` ile hücresel veri/VPN reddedilir; `ENFORCE_CAMPUS_GPS === "true"` olduğunda sayısal `lat`/`lng` zorunluluğu ve `MAX_DISTANCE_METERS` (`1000` m) sınırı tekrar doğrulanır (`403`).
2. **3 Günlük Aday Penceresi ve Ön Cihaz Denetimi:**
   - `[yesterdayDate, todayDate, tomorrowDate]` aralığındaki `CONFIRMED` ve `CHECKED_IN` randevular içinden Kiosk onay penceresinde (veya aktif `CHECKED_IN` oturumunda) olan randevu bulunur.
   - `checkDeviceLockForReservation` ile yabancı cihaz kilidi varsa `403` döndürülür; öğrenci zaten `presence.checkedUserIds` içindeyse işlem idempotent olarak başarılı döner ve `httpOnly` kilit çerezi yenilenir.
3. **Atomik PostgreSQL Yoklama ve Cihaz Mühürleme (`performCheckIn`):**
   - Tek bir PostgreSQL transaction'ı (`SELECT ... FOR UPDATE`) içinde:
     - `kiosk_check_in_codes` tablosundaki tek kullanımlık `personalSessionToken` tüketilir (`consumed_at = NOW()`),
     - `DEVICE`, `HARDWARE` ve `IP_UA` kilitleri `kiosk_device_locks` tablosuna 4 saat (`14400` sn) boyunca bu öğrenci adına mühürlenir,
     - `kiosk_attendances` tablosuna kalıcı yoklama satırı eklenir ve `onRecorded` geri çağrısıyla `AuditLog` (`RESERVATION_CHECKED_IN`) kaydı aynı transaction içinde yazılır.
   - Tarayıcıya `getBrowserCookiePath()` (`/randevu` veya `/`) yolunda 4 saatlik `httpOnly` `thku_checkin_lock_${reservation.id}` çerezi basılır.
4. **En Az 2 Kişi (`minCheckinParticipants`) Eşiği ve Müdür Bildirimi:**
   - Onaylayan kişi sayısı `minCheckinParticipants` (varsayılan 2) altındaysa randevu `CONFIRMED` kalır.
   - Eşik sağlandığı anda `performCheckIn` durumu atomik olarak `CHECKED_IN` yapar (`outcome.transitioned === true`) ve yalnızca bu ilk geçiş anında `sendKioskCheckInEmailToStaff` ile Kütüphane Müdürüne e-posta gönderilir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Kiosk.jsx`
- `backend/src/lib/kioskStore.js` & `backend/src/lib/kioskSecurity.js`
- `backend/src/lib/publicPaths.js` & `backend/src/lib/passwordGate.js`
- `backend/src/app/api/kiosk/qr/route.js`
