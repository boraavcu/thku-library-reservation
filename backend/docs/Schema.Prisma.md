# Context: schema.prisma

##  1. Dosyanın Amacı ve Mimari Rolü

`schema.prisma`, sistemin PostgreSQL ilişkisel veritabanı mimarisini, 20 tablosunu (model), 9 sabit tipini (enum), yabancı anahtar (foreign key) ilişkilerini ve performans indekslerini tanımlayan ana veri şemasıdır.

##  2. Veritabanı Sağlayıcısı ve Özellikler

- **Veritabanı:** PostgreSQL (`url = env("DATABASE_URL")`)
- **ORM Üreticisi:** `prisma-client-js` (`previewFeatures = ["fullTextSearch"]`)
- **Birincil Anahtarlar:** Tüm tablolarda `@id @default(uuid()) @db.Uuid` standardı kullanılmıştır.

##  3. Çekirdek Modeller (Tablolar) ve İlişkileri

1. **`User` (`users`):**
   - Öğrenci ve yetkili kayıtlarını tutar (`studentNumber`, `email`, `fullName`, `phone`, `department`, `avatarUrl`, `acceptedAgreementVersion`, `role`).
   - Ceza ve ban yönetimi için `penaltyPoints`, `isBanned`, `banUntil` (`Timestamp`) ve `banReason` alanlarını içerir.
2. **`Room` (`rooms`):**
   - Çalışma odalarını (`roomNumber`: `R101`–`R104`, `name`, `capacity`, `isActive`) tutar.
3. **`Reservation` (`reservations`):**
   - Oda rezervasyonlarını tutar (`roomId`, `userId`, `reservationDate` (`@db.Date`), `startTime` (`@db.Time(6)`), `endTime` (`@db.Time(6)`), `purpose`, `status`).
   - Kiosk yoklama ve ceza takibi için `checkedInAt`, `checkedInById`, `noShow` ve `penaltyApplied` (`Boolean`) alanlarına sahiptir.
   - `@@unique([userId, reservationDate, startTime], name: "unique_user_time")` kısıtlaması ile aynı kullanıcının aynı saatte mükerrer kayıt açmasını veritabanı seviyesinde engeller.
4. **`ReservationParticipant` (`reservation_participants`):**
   - Grup randevularına davet edilen öğrencileri ve onay durumlarını (`PENDING`, `ACCEPTED`, `REJECTED`, `joinedAt`) tutar.
5. **`PenaltyHistory` (`penalty_history`):**
   - Öğrencilerin aldığı `NO_SHOW` uyarılarını (`penaltyPoints: 15`, `isActive: true`) tarihçesiyle saklar. Ban açıldığında veya uyarılar sıfırlandığında `isActive: false` yapılarak geçmiş denetim izi korunur.
6. **`ReservationRule` (`reservation_rules`):**
   - Yöneticinin panelden değiştirebildiği 7 dinamik kuralı (`MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`, `MAX_DURATION_HOURS`, `MAX_ADVANCE_DAYS`, `DAILY_RELEASE_HOUR`, `CHECKIN_TOLERANCE_MINUTES`, `CANCEL_LOCK_MINUTES`) JSON formatında (`ruleValue`) saklar.
7. **`Agreement` (`agreements`):**
   - Kullanıcı sözleşmesi metinlerini ve aktif versiyon bilgisini (`version: "v1.0"`, `isActive: true`) tutar.
8. **`Announcement` (`announcements`):**
   - Çok dilli (`title: Json`, `content: Json` -> `{ tr, en }`) ve öncelikli (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) duyuruları tutar.
9. **`AuditLog` (`audit_logs`) & `AdminAction` (`admin_actions`):**
   - Öğrenci/sistem hareketlerini (`AuditLog`) ve görevli/müdür müdahalelerini (`AdminAction`) `oldData` ve `newData` JSON farklarıyla birlikte 180 gün aktif görünüm / 365 gün arşiv politikasına uygun olarak indeksler.
10. **`Notification` (`notifications`) & `EmailQueue` (`email_queue`):**
    - Kullanıcı bildirimlerini ve SMTP e-posta kuyruğunun gönderim durumlarını (`PENDING`, `SENT`, `FAILED`, `attempts`, `errorMessage`) tutar.
11. **NextAuth & Kurumsal Genişleme Tabloları:**
    - `Account`, `Session`, `VerificationToken` (NextAuth SSO tabloları) ile `SystemSetting`, `DashboardStats`, `BulkOperation`, `ReportTemplate`, `ScheduledTask` modellerini barındırır.

##  4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/db.js` ve `backend/prisma/seed.cjs`