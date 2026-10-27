# Context: reservations/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/reservations/route.js`, rezervasyon oluşturma (`POST`), kullanıcının tüm randevularını listeleme (`GET`), odayı erken boşaltma (`PATCH`) ve randevu iptal etme (`DELETE`) işlemlerini yürüten temel rezervasyon servisidir.

##  2. HTTP Metotları ve İş Kuralları

### A. `POST` — Yeni Grup Rezervasyonu Oluşturma
Sözleşme kontrolü (`checkRulesAcceptance`) ve yaşam döngüsü temizliğinin ardından şu 9 kuralı denetler:
1. **Ban Kontrolü:** Organizatör banlıysa (`isBanned`) `403` ile reddedilir.
2. **Oda Aktiflik ve Kapasite Kontrolü:** Oda bakımdaysa (`!room.isActive`) veya grup büyüklüğü `MIN_PARTICIPANTS` (2) – `MAX_PARTICIPANTS` (8) sınırları dışındaysa reddedilir.
3. **Süre Sınırı:** Randevu süresi `MAX_DURATION_HOURS` (3 saat) sınırını aşıyorsa reddedilir (`23:59` gece yarısı bitişleri otomatik 24.0 saat olarak hesaplanır).
4. **İleri Tarih ve Saat 08:00 Kotası (`MAX_ADVANCE_DAYS` & `DAILY_RELEASE_HOUR`):** En fazla 1 gün sonrasına randevu alınabilir ve yarının randevuları sabah saat `08:00`'den önce açılmaz.
5. **Geçmiş Saat ve Ara Dakika Kuralı:** Bugün için seçilen saat dilimi tamamen bitmişse (`endTotalMins <= currentMinutes`) reddedilir; ancak içinde bulunulan saat dilimi devam ediyorsa (boşa düşen odayı anında tutma senaryosu) izin verilir.
6. **Oda Çakışma Kontrolü:** Aynı odada aynı saat aralığında `PENDING`, `CONFIRMED` veya `CHECKED_IN` durumunda başka bir kayıt varsa `409 Conflict` döner.
7. **Günlük 1 Randevu Hakkı ve Gece-Gündüz Kuralı (Organizatör + Tüm Davetliler İçin):**
   - Gruptaki herhangi bir üyenin aynı gün içinde başka bir aktif/tamamlanmış randevusu varsa (1. kişi kursa, 2. kişi kursa bile) engellenir.
   - Gece `21:00 – 24:00` arasında randevusu olan bir üye ertesi sabah `00:00 – 08:00` arasına (veya tam tersi) randevu alamaz.
8. **Kayıt ve Bildirim:** Randevu `PENDING` durumunda oluşturulur, davetlilere `INVITATION_RECEIVED` bildirimi ve kurumsal davet e-postası gönderilir.

### B. `GET` — Kullanıcının Rezervasyonlarını Listeleme
- Öğrencinin organizatör veya katılımcı olduğu tüm randevuları oda ve katılımcı detaylarıyla birlikte döndürür.

### C. `PATCH` — Odayı Erken Boşaltma (`action === "EARLY_CHECKOUT"`)
- Yalnızca randevu saati **şu an aktif olarak devam ediyorsa (`isHappeningNow`)** çalışır; gelecekteki randevular henüz başlamadan erken boşaltılamaz.
- Randevunun durumunu `COMPLETED` yapar ve `endTime` değerini şu anki saate çekerek kalan süreyi diğer öğrencilerin kullanımına açar.

### D. `DELETE` — Randevu İptali ve Dinamik İptal Kilidi (`CANCEL_LOCK_MINUTES`)
- Randevu saati başlamışsa veya başlangıcına `CANCEL_LOCK_MINUTES` (varsayılan 60 dk) süreden az kalmışsa iptal işlemine izin verilmez (`400 Bad Request`).
- İptal gerçekleştiğinde tüm grup üyelerinin rezervasyonu iptal olur ve `sendReservationCancelledEmails` ile tüm üyelere (ve randevu `CONFIRMED` ise Kütüphane Müdürüne) iptal e-postası gönderilir.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/ReserveForm.jsx` ve `MyBookings.jsx`
- `backend/src/lib/lifecycle.js`