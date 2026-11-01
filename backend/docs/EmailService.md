## 1. Dosyanın Amacı ve Mimari Rolü

`emailService.js`, üniversite kurumsal e-posta altyapısı (SMTP) üzerinden öğrencilere ve kütüphane personeline iletilen tüm bildirimlerin tek merkezden oluşturulmasını, kurumsal HTML şablonlarıyla giydirilmesini ve güvenli kuyruğa alınarak gönderilmesini sağlayan bağımsız e-posta servisidir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **E-Posta Kütüphanesi:** `nodemailer`
- **Veritabanı ORM:** `@/lib/db` (`EmailQueue` tablosu)
- **Çevre Değişkenleri:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `DIRECTOR_EMAIL`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Kurumsal Duyarlı (Responsive) HTML Şablonu (`buildCorporateEmailHtml`)
- THKÜ resmi logosu (`THKU_LOGO_URL`), `#C8102E` (havacılık kırmızısı) üst hat, `#0F172A` (lacivert) başlık alanı, durum rozetleri (`badgeText`), randevu bilgi tablosu ve sarı renkli kural hatırlatma paneli içeren kurumsal tasarım üretir.

### B. Güvenli Gönderim ve Beyaz Liste Koruması (`queueSafeEmail`)
- Test ve geliştirme aşamasında `@demo.local` veya sahte e-postalara gönderim yapılmasını engelleyen beyaz liste kontrolü (`SAFE_EMAIL_WHITELIST`).
- Gönderilen her e-posta önce veritabanındaki `EmailQueue` tablosuna `PENDING` olarak kaydedilir; SMTP iletilince `SENT`, hata oluşursa `FAILED` ve deneme sayısı (`attempts`) güncellenir.

### C. Olay Bazlı Gönderim Fonksiyonları
1. `sendInvitationEmail`: Arkadaş davetlerinde 30 dakikalık onay linkini ve rezervasyon detaylarını iletir.
2. `sendKioskCheckInEmailToStaff`: Yoklama tamamlandığında Kütüphane Müdürüne odanın açıldığını bildirir.
3. `sendReservationCancelledEmails`: İptal durumunda gruptaki tüm öğrencileri bilgilendirir.
4. `sendNoShowWarningEmail`: Ceza puanı alan öğrenciye kural ihlali detaylarını bildirir.
5. `sendBanEmail`: 30 gün banlanan öğrenciye ceza bitiş tarihini bildirir.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/lifecycle.js`
- `backend/src/lib/penaltyService.js`
- `backend/src/app/api/invitations/route.js`
- `backend/src/app/api/reservations/route.js`
- `backend/src/app/api/admin/manage/handlers.js`
