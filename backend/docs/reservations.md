# Context: reservations/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/reservations/route.js`, rezervasyon oluşturma (`POST`), kullanıcının tüm randevularını listeleme (`GET`), odayı erken boşaltma (`PATCH`) ve randevu iptal etme (`DELETE`) işlemlerini yürüten temel rezervasyon servisidir. İş kuralları ve kota doğrulamaları için `@/lib/reservationPolicy` modülünü kullanır.

##  2. HTTP Metotları ve İş Kuralları

### A. `POST` — Yeni Grup Rezervasyonu Oluşturma (Serializable Transaction Korumalı)
Sözleşme kontrolü (`checkRulesAcceptance`) ve yaşam döngüsü temizliğinin ardından şu kuralları denetler:
1. **Ban Kontrolü:** Organizatör banlıysa (`isBanned`) `403` ile reddedilir.
2. **Oda Aktiflik ve Kapasite Kontrolü:** Oda bakımdaysa (`!room.isActive`) veya grup büyüklüğü `MIN_PARTICIPANTS` (2) – `Math.min(room.capacity, MAX_PARTICIPANTS)` sınırları dışındaysa reddedilir.
3. **Süre Sınırı:** Randevu süresi `MAX_DURATION_HOURS` (3 saat) sınırını aşıyorsa reddedilir (`23:59` gece yarısı bitişleri otomatik 24.0 saat olarak hesaplanır).
4. **İleri Tarih ve Saat 08:00 Kotası (`MAX_ADVANCE_DAYS` & `DAILY_RELEASE_HOUR`):** En fazla 1 gün sonrasına randevu alınabilir ve yarının randevuları sabah saat `08:00`'den önce açılmaz.
5. **Geçmiş Saat ve Ara Dakika Kuralı:** Bugün için seçilen saat dilimi tamamen bitmişse (`endTotalMins <= currentMinutes`) reddedilir; ancak içinde bulunulan saat dilimi devam ediyorsa (boşa düşen odayı anında tutma senaryosu) izin verilir.
6. **Günlük 1 Randevu Hakkı ve Gece-Gündüz Kuralı (`reservationPolicy.js`):**
   - `validateDailyQuotaForUsers`: Gruptaki herhangi bir üyenin aynı gün içinde başka bir aktif/tamamlanmış randevusu varsa engellenir.
   - `validateNightToMorningRuleForUsers`: Gece `21:00 – 24:00` arasında randevusu olan bir üye ertesi sabah `00:00 – 08:00` arasına (veya tam tersi) randevu alamaz.
7. **Atomik Çakışma Kontrolü ve Kayıt (`prisma.$transaction` — `Serializable`):**
   - İki grubun aynı milisaniyede aynı odayı tutmasını (Race Condition) engellemek için çakışma kontrolü (`conflict`) ve `reservation.create` işlemi `Serializable` izolasyon seviyesinde tek bir veritabanı transaction'ı içinde çalıştırılır.

### B. `GET` — Kullanıcının Rezervasyonlarını Listeleme
- Öğrencinin organizatör veya katılımcı olduğu tüm randevuları oda ve katılımcı detaylarıyla birlikte döndürür.

### C. `PATCH` — Odayı Erken Boşaltma (`action === "EARLY_CHECKOUT"`)
- **No-Show Bypass Koruması:** Öğrenciler yalnızca kapı QR kodunu okutup giriş yaptıkları (`reservation.status === "CHECKED_IN"`) aktif bir odayı erken boşaltabilir; henüz QR okutulmamış `CONFIRMED` randevular erken boşaltılarak No-Show cezasından kaçılamaz.
- Randevunun durumunu `COMPLETED` yapar ve `endTime` değerini şu anki saate çekerek kalan süreyi diğer öğrencilerin kullanımına açar.

### D. `DELETE` — Randevu İptali ve Dinamik İptal Kilidi (`CANCEL_LOCK_MINUTES`)
- Giriş (`CHECKED_IN`) yapılmış randevular iptal edilemez.
- Randevu başlangıcına `CANCEL_LOCK_MINUTES` (varsayılan 60 dk) süreden az kalmışsa öğrenci iptaline izin verilmez (`400 Bad Request`).
- İptal gerçekleştiğinde `sendReservationCancelledEmails` ile tüm üyelere (ve randevu `CONFIRMED` ise Kütüphane Müdürüne) iptal e-postası gönderilir.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/ReserveForm.jsx` ve `MyBookings.jsx`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/lib/timeUtils.js`
- `backend/src/lib/lifecycle.js`
