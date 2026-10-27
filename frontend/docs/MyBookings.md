# Context: MyBookings.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`MyBookings.jsx`, öğrencilerin tüm rezervasyon yaşam döngüsünü yönettiği sayfadır. Öğrenciler bu ekrandan aktif/gelecek randevularını takip edebilir, randevu saati başladığında **Odayı Erken Boşalt (`EARLY_CHECKOUT`)** işlemi yapabilir, randevuya 1 saatten fazla süre varsa **İptal Et** işlemini gerçekleştirebilir, kendilerine gelen grup davetlerini yanıtlayabilir ve geçmiş/iptal edilen randevularını inceleyebilir.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`) 
- **Yönlendirme:** `react-router-dom` (`useNavigate`) 
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN`) 
- **API İstemcisi:** `../api` (`GET/PATCH/DELETE /api/reservations`, `GET /api/invitations`, `POST /api/invitations/respond`) 

##  3. İş Mantığı, Zamanlama Hesaplaması ve Ban Kısıtlamaları

### A. Zamanlama Durumu Hesaplayıcısı (`getReservationTimingState`)
Her rezervasyon kartı için Türkiye saat dilimine (`Europe/Istanbul`) ve UTC saatlerine göre 3 kritik boolean bayrak hesaplanır:
1. **`isHappeningNow`:** Randevu durumu `CHECKED_IN` ise veya (`CONFIRMED` olup şu anki dakika `resStartEpochMins` ile `resEndEpochMins` arasındaysa) `true` döner . **"Odayı Erken Boşalt"** butonu yalnızca `isHappeningNow === true` olduğunda görünür.
2. **`hasStarted`:** Randevu başlangıç saati geldiyse veya odaya giriş yapıldıysa `true` olur; bu durumda **"İptal Et"** butonu gizlenir.
3. **`cancelLocked`:** Randevu başlangıcına 60 dakikadan (`resStartEpochMins - nowEpochMins < 60`) az kaldıysa `true` döner . İptal butonu `disabled` olur ve üzerinde *"Son 1 Saat (İptal Kilitli)"* yazar.

### B. Banlı Öğrenci Kısıtlamaları (`isBanned`)
- `const isBanned = Boolean(session?.user?.isBanned);` kontrolü ile banlı öğrencilerin sağ üstteki **"Oda Rezerve Et"** butonu `disabled` yapılır ve metni *"Hesap Askıda / Suspended"* olarak değiştirilir.
- **Gelen Grup Davetleri (`tab === 1`)** sekmesindeki **"Kabul Et"** butonu da `disabled={isBanned}` ile kilitlenir; böylece banlı bir öğrenci başka bir öğrencinin daveti üzerinden kısıtlamayı aşamaz.

### C. 3 Sekmeli Görünüm Yapısı
- **Sekme 0 (`Aktif Rezervasyonlarım`):** `PENDING`, `CONFIRMED` ve `CHECKED_IN` durumundaki randevuları ve katılımcıların onay durumlarını (`ACCEPTED`, `PENDING`, `REJECTED`) listeler.
- **Sekme 1 (`Gelen Grup Davetleri`):** 30 dakikalık onay süresi devam eden grup davetlerini listeler.
- **Sekme 2 (`Geçmiş & İptal Edilenler`):** `COMPLETED`, `CANCELLED` ve `NO_SHOW` durumundaki geçmiş kayıtları listeler.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/reservations/route.js` (`GET`, `PATCH`, `DELETE`) 
- `backend/src/app/api/invitations/route.js` (`GET`) 
- `backend/src/app/api/invitations/respond/route.js` (`POST`) 