# Context: emailService.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/emailService.js`, üniversite kurumsal e-posta altyapısı (SMTP) üzerinden öğrencilere ve kütüphane personeline iletilen tüm bildirimlerin tek merkezden oluşturulmasını, XSS korumalı kurumsal HTML şablonlarıyla giydirilmesini ve güvenli kuyruğa (`EmailQueue`) alınarak gönderilmesini sağlayan bağımsız e-posta servisidir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **E-Posta Kütüphanesi:** `nodemailer`
- **Veritabanı ORM:** `@/lib/db` (`EmailQueue`, `Reservation`, `Notification`, `User`)
- **Zaman ve Güvenlik Yardımcıları:** `@/lib/timeUtils` (`fmtTimeUTC`, `fmtDateUTC`, `escapeHtml`)
- **Çevre Değişkenleri:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `DIRECTOR_EMAIL`, `FRONTEND_URL`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. XSS Korumalı Kurumsal Duyarlı (Responsive) HTML Şablonu (`buildCorporateEmailHtml`)
- THKÜ resmi logosu (`THKU_LOGO_URL`), `#C8102E` (havacılık kırmızısı) üst hat, `#0F172A` (lacivert) başlık alanı, durum rozetleri (`badgeText`), randevu bilgi tablosu ve sarı renkli kural hatırlatma paneli içeren kurumsal tasarım üretir.
- Kullanıcı girdisi olan tüm alanlar (`title`, `greeting`, `details`, `purpose`, `reason`) `escapeHtml()` fonksiyonundan geçirilerek HTML/XSS enjeksiyonuna karşı korunur.

### B. Güvenli Gönderim ve Beyaz Liste Koruması (`queueSafeEmail`)
- Test ve geliştirme aşamasında `@demo.local` veya sahte e-postalara gerçek SMTP gönderimi yapılmasını engelleyen beyaz liste kontrolü (`isSafeRecipientEmail`) uygular.
- Gönderilen her e-posta önce veritabanındaki `EmailQueue` tablosuna `PENDING` olarak kaydedilir; SMTP iletilince `SENT`, hata oluşursa `FAILED` olarak güncellenir.

### C. Olay Bazlı Gönderim Fonksiyonları
1. `sendReservationInvitationEmails`: Arkadaş davetlerinde 30 dakikalık onay linkini ve rezervasyon detaylarını iletir.
2. `handleParticipantAcceptedEmails`: Davet kabul edildiğinde organizatöre ve katılımcılara bilgi verir; minimum grup sayısı (`MIN_PARTICIPANTS`) ilk kez sağlandığında (`isInitialConfirmation === true`) Kütüphane Müdürüne **"[Kütüphane Müdürlüğü] Oda Ayrıldı"** raporu gönderir.
3. `sendKioskCheckInEmailToStaff`: Kapı QR yoklaması tamamlandığında Kütüphane Müdürüne odanın açıldığını ve içerideki/beklenen üyeleri bildirir.
4. `sendReservationCancelledEmails`: İptal durumunda gruptaki tüm öğrencileri (ve onaylı randevuysa Kütüphane Müdürünü) bilgilendirir.
5. `sendNoShowWarningEmail`: Kapı QR onayı vermeyen öğrenciye kaçıncı uyarısını (`1/3`, `2/3` veya `3/3` Otomatik 30 Gün Ban) aldığını bildirir.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/lifecycle.js`
- `backend/src/lib/penaltyService.js`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/app/api/invitations/respond/route.js`
- `backend/src/app/api/reservations/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/app/api/admin/manage/handlers.js`
