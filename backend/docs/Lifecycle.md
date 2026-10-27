# Context: lifecycle.js

##  1. Dosyanın Amacı ve Mimari Rolü

`lifecycle.js`, **THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi**'nin arka plan otomasyon motoru, zamanlayıcısı (scheduler), adil disiplin/ceza denetleyicisi ve kurumsal HTML e-posta gönderim merkezidir. Hem her 30 saniyede bir çalışan dahili `setInterval` zamanlayıcısıyla hem de kritik API uç noktalarından tetiklenen `runReservationLifecycleChecks()` fonksiyonuyla rezervasyonların yaşam döngüsünü 7/24 otonom olarak yönetir.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client)
- **Önbellek & Kiosk Yoklama Setleri:** `@/lib/redis` (`ioredis` — `kiosk:checked_users:${reservationId}` kümesi)
- **E-Posta Motoru:** `nodemailer` (`createFreshTransporter` ile SMTP üzerinden kurumsal HTML gönderimi)
- **Saat Dilimi Yönetimi:** `Intl.DateTimeFormat` (`Europe/Istanbul` saat dilimi ve UTC saat normalizasyonu)

##  3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Kurumsal HTML E-Posta Şablonu ve Güvenli Kuyruk (`buildCorporateEmailHtml` & `queueSafeEmail`)
1. **Görsel Kurumsal Şablon (`buildCorporateEmailHtml`):**
   - Gönderilen tüm e-postaları THKÜ logolu, `#C8102E` (kurumsal kırmızı) üst şeritli, `#0F172A` (lacivert) antetli, durum rozetli (`badgeText`), tablo detaylı, katılımcı listeli ve sarı hatırlatma kutulu (`rulesList`) duyarlı (responsive) bir HTML şablonuna dönüştürür.
2. **Güvenli Gönderim ve Beyaz Liste (`SAFE_EMAIL_WHITELIST`):**
   - Demo ve test aşamasında `@demo.local` uzantılı sahte öğrenci adreslerine SMTP isteği atılıp sunucunun "Address not found" hatası almaması için yalnızca gerçek test hesaplarına (`s250444902@stu.thk.edu.tr` ve `boraa-35@hotmail.com` / `process.env.DIRECTOR_EMAIL`) gerçek SMTP gönderimi yapar.
   - Her e-posta önce `prisma.emailQueue` tablosuna `PENDING` olarak kaydedilir; `createFreshTransporter()` ile gönderim başarılı olursa `SENT` (`sentAt`), hata alırsa `FAILED` (`errorMessage`, `attempts`) olarak güncellenir.

### B. Dinamik Kiosk Yoklama Penceresi Hesaplayıcısı (`getReservationKioskWindow`)
Normal randevular ile boşa düşen odayı sonradan tutan (walk-in) randevuları birbirinden ayıran kritik fonksiyondur:
1. **Normal Randevular (`createdAt <= startTotalMins`):**
   - Randevu başlangıç saatinden önce (örneğin saat `16:00` randevusu saat `15:50`'de veya dün) oluşturulduysa, Kiosk kapı QR onay penceresi kesin olarak **`startTotalMins - toleranceMinutes` ile `startTotalMins + toleranceMinutes`** (örneğin `15:45 – 16:15`) arasındadır.
   - Davet edilen arkadaşın daveti `16:04` veya `16:14`'te kabul etmesi (`updatedAt`) bu pencereyi **asla uzatmaz**; son onay dakikası `16:15` olarak sabit kalır.
2. **Boşa Düşen Odayı Ara Dakikada Tutma (`createdAt > startTotalMins`):**
   - Eğer `16:00` randevusu olan ilk grup gelmediği için `16:16`'da oda `NO_SHOW` olup boşa düştüyse (veya erken boşaltıldıysa) ve saat `16:20`'de gelen yeni bir grup `16:00 – 18:00` dilimini sıfırdan rezerve ettiyse (`createdInfo.totalMins > startTotalMins`), bu yeni gruba odaya girerken hemen QR okutabilmeleri için **`[createdInfo.totalMins, createdInfo.totalMins + toleranceMinutes]` (`16:20 – 16:35`)** aralığında 15 dakikalık Kiosk onay penceresi tanımlar.

### C. Otomatik Yaşam Döngüsü Denetimleri (`runReservationLifecycleChecks`)
Çakışmaları önlemek için `globalThis.__thkuLifecycleRunning` kilidiyle çalışan fonksiyon her döngüde şu 3 denetimi yapar:
1. **30 Dakikalık Davet Süre Aşımı (`INVITATION_TIMEOUT_MS`):**
   - Oluşturulmasının üzerinden 30 dakika geçtiği halde hâlâ `PENDING` durumunda kalan (yeterli davet onayı almamış) randevuları otomatik olarak `CANCELLED` yapar, `AuditLog` tablosuna `AUTO_TIMEOUT_CANCELLED` kaydı düşer ve organizatöre bilgi maili atar.
2. **Son 2 Saat Hatırlatma Bildirimi (`RESERVATION_REMINDER`):**
   - Başlangıcına 120 dakika veya daha az kalan `CONFIRMED` randevular için (daha önce gönderilmediyse) tüm grup üyelerine *"Randevunuza Son 2 Saat Kaldı (Son 1 saat içinde iptal yapılamaz)"* bildirimi ve e-postası gönderir.
3. **Kiosk Yoklama Süresi (`deadlineMins`) Dolduğunda Adil No-Show ve Otomatik Ban Denetimi:**
   - **Senaryo 1 (En Az 2 Kişi QR Okutmadı -> Oda İptal & Boşa Çıkarma):**
     - `checkedUserIds.length < minRequiredPeople` ise randevu otomatik olarak `NO_SHOW` durumuna çekilir ve oda takvimde anında diğer öğrencilere açılır (`AUTO_KIOSK_CANCELLED`).
     - **Adil Ceza Koruması (`verifiedUsers` vs `absentUsers`):** Grupta kendi üzerine düşeni yapıp kapıda QR okutmuş olan öğrenci varsa (`verifiedUsers`), ona **kesinlikle ceza yazılmaz** ve *"Tarafınıza ceza işlenmemiştir"* bilgi maili gider.
     - Kapıda QR okutmayan üyelere (`absentUsers`) ise `PenaltyHistory` tablosunda `15 puan` (`NO_SHOW`) işlenir (`AUTO_NO_SHOW_PENALTY`). Aktif uyarı sayısı `3/3` olan öğrenci otomatik olarak **30 gün banlanır** (`AUTO_NO_SHOW_BANNED`), gelecekteki aktif randevuları iptal edilir ve Kütüphane Müdürüne yoklama özetini içeren otomatik iptal raporu maili gönderilir.
   - **Senaryo 2 (En Az 2 Kişi Okutup Odayı Açtı, Ancak 3./4. Üye Gelmedi):**
     - Oda iptal edilmez (içerideki grup çalışmasına devam eder), ancak kapı QR kodunu okutmayan `absentUsers` üyelerine bireysel `1/3 No-Show` uyarısı (ve `3/3` ise 30 gün ban) otomatik işlenir.

### D. Kütüphane Müdürüne ve Öğrencilere Giden 4 Olay Güdümlü E-Posta Fonksiyonu
1. **`handleParticipantAcceptedEmails`:**
   - Yalnızca 2. kişi (Organizatör + 1. onaylayan davetli = `minParticipants`) daveti kabul ettiğinde (`isInitialConfirmation === true`) Kütüphane Müdürüne **"[Kütüphane Müdürlüğü] Oda Ayrıldı"** maili ve ilk 2 öğrenciye onay maili gönderir.
   - 3., 4., 5. katılımcılar daveti kabul ettiğinde müdüre tekrar mail gitmez; sadece kabul eden öğrenciye katılım onay maili gider.
2. **`sendKioskCheckInEmailToStaff`:**
   - Kapıdaki QR kodu en az 2 grup üyesi onaylayıp oda `CONFIRMED -> CHECKED_IN` durumuna geçtiği anda Kütüphane Müdürüne **"[Randevu Başladı - Kiosk Onaylandı]"** maili gönderir.
3. **`sendReservationCancelledEmails`:**
   - Randevu iptal edildiğinde tüm grup üyelerine iptal maili gönderir; eğer iptal edilen randevu daha önce onaylanmış (`wasConfirmed`) bir randevuysa Kütüphane Müdürüne de **"[Kütüphane Müdürlüğü] Onaylı Randevu İptal Edildi"** maili gönderir.
4. **`sendNoShowWarningEmail`:**
   - Öğrenciye kaçıncı uyarısını aldığını (`1/3`, `2/3`), kalan hakkını veya `3/3` dolduysa ban bitiş tarihini (`banUntilDate`) bildiren disiplin e-postasını gönderir.

##  4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/app/api/invitations/respond/route.js`
- `backend/src/app/api/reservations/route.js` & `active/route.js`
- `backend/src/app/api/rooms/[id]/availability/route.js`
- `backend/src/app/api/admin/manage/route.js`