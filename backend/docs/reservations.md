# Context: reservations/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/reservations/route.js`, grup çalışma odası rezervasyonu oluşturma (`POST`), kullanıcının tüm randevularını listeleme (`GET`), odayı erken boşaltma (`PATCH`) ve randevu iptal etme (`DELETE`) işlemlerini yürüten çekirdek rezervasyon servisidir. İş kuralları ve kota doğrulamaları için `@/lib/reservationPolicy` modülünü, çift rezervasyon (Double Booking) önleme için ise PostgreSQL `SELECT ... FOR UPDATE` satır kilidini kullanır.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum, Şifre & Sözleşme Kapıları:** `next-auth` (`getServerSession`, `authOptions`), `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`) & `@/middleware/checkRulesAcceptance`
- **Veritabanı ORM & Satır Kilidi:** `@/lib/db` (`PrismaClient` — `$transaction`, `$queryRawUnsafe`)
- **Politika, Zaman & Yaşam Döngüsü:** `@/lib/reservationPolicy`, `@/lib/timeUtils`, `@/lib/lifecycle`

## 3. HTTP Metotları ve Çekirdek İş Kuralları

### A. `POST` — Yeni Grup Rezervasyonu Oluşturma (`FOR UPDATE` Kilit Korumalı)
`checkRulesAcceptance`, `rejectIfPasswordChangeRequired` ve `runReservationLifecycleChecks()` adımlarından sonra şu kuralları uygular:
1. **Ban Kontrolü:** Organizatör veya davet edilen herhangi bir katılımcı banlıysa (`isBanned`) işlem reddedilir.
2. **Oda Aktiflik ve Grup Kapasitesi:** Oda aktif değilse veya toplam üye sayısı `minParticipants` (2) – `Math.min(room.capacity, maxParticipants)` aralığı dışındaysa reddedilir.
3. **Süre, İleri Tarih ve 08:00 Kotası:** Süre `maxDurationHours` (3 saat) sınırını aşamaz; `maxAdvanceDays` (1 gün) sonrasına yalnızca `dailyReleaseHour` (`08:00`) itibarıyla randevu alınabilir.
4. **Günlük 1 Randevu Kotası ve Gece-Sabah Kuralı:** `validateDailyQuotaForUsers` ve `validateNightToMorningRuleForUsers` ile tüm grup üyeleri doğrulanır.
5. **PostgreSQL `FOR UPDATE` Satır Kilidi ve Erken Boşaltılmış Odaların Açılması (`prisma.$transaction`):**
   - `SELECT id FROM rooms WHERE id = $1::uuid FOR UPDATE` ile hedef oda satırı transaction süresince kilitlenerek eşzamanlı yarış durumları engellenir.
   - Çakışma kontrolü yalnızca `ACTIVE_ROOM_STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN"]` durumundaki randevular üzerinde yapılır; böylece iptal edilen, No-Show olan veya **erken boşaltılarak `COMPLETED` durumuna geçen** saat dilimleri anında yeni rezervasyonlara açılır.
   - Kullanıcının aynı tarih ve başlangıç saatinde geçmişten kalan `INACTIVE_ROOM_STATUSES = ["CANCELLED", "NO_SHOW", "COMPLETED"]` kaydı varsa, analitik ve `PenaltyHistory` yabancı anahtar bütünlüğünü bozmadan `startTime` saniyesi birkaç saniye kaydırılarak `unique_user_time` kısıtlaması çakışması önlenir.
   - Kayıt oluşturulur (`PENDING`), `AuditLog` (`RESERVATION_CREATED`) yazılır ve davet e-postaları tetiklenir (`201 Created`).

### B. `GET` — Kullanıcının Rezervasyonlarını Listeleme
- `checkRulesAcceptance` ve `rejectIfPasswordChangeRequired` denetimlerinden sonra öğrencinin organizatör veya onaylı (`ACCEPTED`) katılımcı olduğu tüm randevuları oda ve katılımcı bilgileriyle döndürür.

### C. `PATCH` — Odayı Erken Boşaltma (`action === "EARLY_CHECKOUT"`)
- `rejectIfPasswordChangeRequired` kontrolü yapılır. Yalnızca organizatör veya yetkili personel (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) çağırabilir.
- **No-Show Bypass Koruması:** Öğrenciler yalnızca kapı QR kodunu okutup giriş yaptıkları (`status === "CHECKED_IN"`) aktif bir odayı erken boşaltabilir.
- Randevu durumu `COMPLETED` yapılır; ileri tarihli randevuda `endTime = startTime`, bugünkü aktif randevuda ise `endTime` o anki saate çekilerek kalan saatler diğer öğrencilere açılır (`RESERVATION_EARLY_CHECKOUT`).

### D. `DELETE` — Randevu İptali ve Dinamik İptal Kilidi (`CANCEL_LOCK_MINUTES`)
- `rejectIfPasswordChangeRequired` kontrolü yapılır. Öğrenciler `CHECKED_IN` olmuş veya başlangıcına `cancelLockMinutes` (varsayılan 60 dk) süreden az kalmış randevuları iptal edemez (`400`); yetkili personel ise her aşamada iptal edebilir.
- İptal sonrasında `AuditLog` (`RESERVATION_CANCELLED`) yazılır ve `sendReservationCancelledEmails` tetiklenir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/ReserveForm.jsx` & `frontend/src/pages/MyBookings.jsx`
- `backend/src/lib/reservationPolicy.js` & `backend/src/lib/passwordGate.js`
- `backend/src/middleware/checkRulesAcceptance.js`
- `backend/src/lib/timeUtils.js` & `backend/src/lib/lifecycle.js`
