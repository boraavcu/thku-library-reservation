# Context: emailService.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/emailService.js`, üniversite kurumsal e-posta altyapısı (SMTP) üzerinden öğrencilere ve kütüphane personeline iletilen tüm bildirimlerin tek merkezden oluşturulmasını, XSS korumalı kurumsal HTML şablonlarıyla giydirilmesini ve güvenli kuyruğa (`EmailQueue`) alınarak gönderilmesini sağlayan bağımsız e-posta servisidir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **E-Posta Kütüphanesi:** `nodemailer`
- **Veritabanı ORM & Yoklama Sorgusu:** `@/lib/db` (`EmailQueue`, `Reservation`, `Notification`) & `@/lib/kioskStore` (`createPrismaDb`, `listAttendanceUserIds` — PostgreSQL `kiosk_attendances`)
- **Zaman ve Güvenlik Yardımcıları:** `@/lib/timeUtils` (`fmtTimeUTC`, `fmtDateUTC`, `escapeHtml`)
- **Çevre Değişkenleri:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_ALLOW_SELF_SIGNED`, `DIRECTOR_EMAIL`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. XSS Korumalı Kurumsal Duyarlı (Responsive) HTML Şablonu (`buildCorporateEmailHtml`)
- THKÜ resmi logosu (`THKU_LOGO_URL`), `#C8102E` (havacılık kırmızısı) üst hat, `#0F172A` (lacivert) başlık alanı, durum rozetleri (`badgeText`), randevu bilgi tablosu ve sarı renkli kural hatırlatma paneli içeren kurumsal tasarım üretir.
- Kullanıcı girdisi olan tüm alanlar (`title`, `greeting`, `details`, `rulesList`) `escapeHtml()` fonksiyonundan geçirilerek HTML/XSS enjeksiyonuna karşı korunur.

### B. Güvenli Gönderim ve Demo E-Posta Koruması (`queueSafeEmail`)
- `@demo.local` uzantılı test hesaplarına gerçek SMTP gönderimi yapılmasını otomatik olarak atlar.
- Gönderilen her e-posta önce veritabanındaki `EmailQueue` tablosuna `PENDING` olarak kaydedilir; SMTP iletilince `SENT`, hata oluşursa `FAILED` (`attempts` artışı ve `errorMessage`) olarak güncellenir.

### C. Olay Bazlı Gönderim ve Şablon Fonksiyonları
1. **`sendReservationInvitationEmails(reservationId)`:** Davet edilen katılımcılara 30 dakikalık onay süresi uyarısını, uygulama içi bildirimi ve grup daveti e-postasını iletir.
2. **`handleParticipantAcceptedEmails`:** Davet kabul edildiğinde katılımcıları bilgilendirir; minimum grup sayısı ilk kez sağlandığında (`isInitialConfirmation === true`) Kütüphane Müdürüne (`ALLOWED_DIRECTOR_EMAIL`) **"[Kütüphane Müdürlüğü] Oda Ayrıldı"** raporu ve onaylı üyelere kesinleşme e-postası gönderir.
3. **`sendKioskCheckInEmailToStaff(reservationId, checkedUserIds)`:** Kapı QR yoklaması tamamlandığında (veya görevli manuel giriş verdiğinde) PostgreSQL `listAttendanceUserIds` üzerinden güncel yoklama listesini alarak Kütüphane Müdürüne odanın kullanıma açıldığını bildirir.
4. **`sendReservationCancelledEmails`:** İptal durumunda gruptaki tüm öğrencileri (ve onaylı randevuysa Kütüphane Müdürünü) bilgilendirir.
5. **`composeNoShowWarning` & `sendNoShowWarningEmail`:** `composeNoShowWarning` veritabanı transaction'ları (`persistNoShowForUser`) içinde yan etkisiz olarak `1/3`, `2/3` veya `3/3` (Otomatik 30 Gün Ban) e-posta içeriğini üretir; `sendNoShowWarningEmail` ise doğrudan gönderim ve bildirim kaydını yürütür.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/lifecycle.js`
- `backend/src/lib/kioskStore.js`
- `backend/src/lib/penaltyService.js`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/app/api/admin/manage/handlers.js`
