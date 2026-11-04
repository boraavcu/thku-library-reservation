# Context: schema.prisma

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/prisma/schema.prisma`, sistemin PostgreSQL ilişkisel veritabanı mimarisini, **24 tablosunu (model)**, **10 sabit tipini (enum)**, yabancı anahtar (foreign key) ilişkilerini ve performans indekslerini tanımlayan ana veri şemasıdır. Harici önbellek katmanı gerektirmeden Kiosk kapı QR yoklaması, cihaz kilitleri, kurumsal şifre yönetimi ve giriş hız sınırlaması dahil tüm durum verileri doğrudan PostgreSQL üzerinde tutulur.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı:** PostgreSQL (`url = env("DATABASE_URL")`)
- **ORM Üreticisi:** `prisma-client-js` (`previewFeatures = ["fullTextSearch"]`)
- **Birincil Anahtarlar:** Kimlik doğrulama belirteçleri hariç tüm tablolarda `@id @default(uuid()) @db.Uuid` standardı kullanılmıştır.

## 3. Çekirdek Modeller (24 Tablo) ve İlişkileri

1. **`User` (`users`):**
   - Öğrenci ve yetkili kayıtlarını tutar (`studentNumber`, `email`, `fullName`, `phone`, `department`, `avatarUrl`, `acceptedAgreementVersion`, `role`, `isActive`).
   - Ceza ve ban yönetimi için `penaltyPoints`, `isBanned`, `banUntil` (`Timestamp`) ve `banReason` alanlarını içerir.
   - Kurumsal personel şifreli girişi ve anında oturum iptali için `passwordHash`, `mustChangePassword` (`@default(false)`), `tempPasswordExpiresAt` ve `sessionVersion` (`@default(0)`) alanlarına sahiptir.
2. **`Room` (`rooms`):**
   - Çalışma odalarını (`roomNumber`: `R101`–`R104`, `name`, `capacity`, `isActive`) tutar.
3. **`Reservation` (`reservations`):**
   - Oda rezervasyonlarını tutar (`roomId`, `userId`, `reservationDate` (`@db.Date`), `startTime` (`@db.Time(6)`), `endTime` (`@db.Time(6)`), `purpose`, `status`).
   - Kiosk yoklama ve ceza takibi için `checkedInAt`, `checkedInById`, `noShow`, `penaltyApplied` alanlarına ve `kioskCheckInCodes`, `kioskDeviceLocks`, `kioskAttendances` ilişkilerine sahiptir.
   - `@@unique([userId, reservationDate, startTime], name: "unique_user_time")` kısıtlaması ile aynı kullanıcının aynı saatte mükerrer kayıt açmasını veritabanı seviyesinde engeller.
4. **`ReservationParticipant` (`reservation_participants`):**
   - Grup randevularına davet edilen öğrencileri ve onay durumlarını (`PENDING`, `ACCEPTED`, `REJECTED`, `joinedAt`) tutar.
5. **`KioskCheckInCode` (`kiosk_check_in_codes`):**
   - Kişiye ve rezervasyona özel 600 saniye geçerli tek kullanımlık kapı doğrulama kodlarını (`code`, `expiresAt`, `consumedAt`) `@@unique([reservationId, userId])` kısıtlamasıyla saklar.
6. **`KioskDeviceLock` (`kiosk_device_locks`):**
   - Aynı fiziksel cihazın bir rezervasyonda ikinci bir öğrenci adına onay vermesini 14400 saniye (4 saat) boyunca engelleyen kilitleri (`lockType`: `DEVICE` | `HARDWARE` | `IP_UA`, `lockKey`, `userId`, `expiresAt`) `@@unique([reservationId, lockType, lockKey])` ile tutar.
7. **`KioskAttendance` (`kiosk_attendances`):**
   - Kalıcı kapı yoklama kayıtlarını (`reservationId`, `userId`, `checkedInAt`) `@@unique([reservationId, userId])` ile saklar; doğrulama kodunun veya cihaz kilidinin süresi dolsa bile silinmez.
8. **`AuthRateLimit` (`auth_rate_limits`):**
   - Kurumsal şifreli giriş denemelerinde IP ve e-posta kovalarını (`bucket` SHA-256 özeti, `failures`, `windowStart`, `updatedAt`) kalıcı olarak izler.
9. **`PenaltyHistory` (`penalty_history`):**
   - Öğrencilerin aldığı `NO_SHOW` uyarılarını (`penaltyPoints: 15`, `isActive: true`) tarihçesiyle saklar. Ban açıldığında veya uyarılar sıfırlandığında `isActive: false` yapılarak geçmiş denetim izi korunur.
10. **`ReservationRule` (`reservation_rules`):**
    - Yöneticinin panelden değiştirebildiği 7 dinamik kuralı (`MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`, `MAX_DURATION_HOURS`, `MAX_ADVANCE_DAYS`, `DAILY_RELEASE_HOUR`, `CHECKIN_TOLERANCE_MINUTES`, `CANCEL_LOCK_MINUTES`) JSON formatında (`ruleValue`) saklar.
11. **`Agreement` (`agreements`):**
    - Kullanıcı sözleşmesi metinlerini ve aktif versiyon bilgisini (`version: "v1.0"`, `isActive: true`) tutar.
12. **`Announcement` (`announcements`):**
    - Çok dilli (`title: Json`, `content: Json` -> `{ tr, en }`) ve öncelikli (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) duyuruları tutar.
13. **`AuditLog` (`audit_logs`) & `AdminAction` (`admin_actions`):**
    - Öğrenci/sistem hareketlerini (`AuditLog`) ve görevli/müdür müdahalelerini (`AdminAction` — `USER_ACCOUNT_CREATED`, `TEMP_PASSWORD_RESET` vb. dahil) 180 gün aktif görünüm / 365 gün arşiv politikasına uygun olarak indeksler.
14. **`Notification` (`notifications`) & `EmailQueue` (`email_queue`):**
    - Kullanıcı bildirimlerini ve SMTP e-posta kuyruğunun gönderim durumlarını (`PENDING`, `SENT`, `FAILED`, `attempts`, `metadata`, `errorMessage`) tutar.
15. **NextAuth & Kurumsal Genişleme Tabloları (8 Model):**
    - `Account`, `Session`, `VerificationToken` (NextAuth SSO tabloları) ile `SystemSetting`, `DashboardStats`, `BulkOperation`, `ReportTemplate`, `ScheduledTask` modellerini barındırır.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/db.js`
- `backend/src/lib/kioskStore.js` & `backend/src/lib/kioskSql.mjs`
- `backend/src/lib/staffAccount.js` & `backend/src/lib/loginRateLimit.js`
- `backend/prisma/seed.cjs`
