# Context: MyBookings.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/MyBookings.jsx`, öğrencilerin tüm rezervasyon yaşam döngüsünü yönettiği ekrandır. Kullanıcılar aktif ve yaklaşan randevularını görüntüleyebilir, kapı QR doğrulaması (`CHECKED_IN`) yapılmış aktif odalarını **Odayı Erken Boşalt (`EARLY_CHECKOUT`)** ile erken teslim edebilir, başlangıca 1 saatten fazla süre varken randevularını iptal edebilir, gelen grup davetlerini yanıtlayabilir ve geçmiş/iptal edilen kayıtlarını inceleyebilir.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama & Yönlendirme:** `next-auth/react` (`useSession`), `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **Zaman Yardımcıları:** `../utils/dateUtils` (`getIstanbulNowParts`, `isReservationEnded`)
- **API İstemcisi:** `../api` (`GET/PATCH/DELETE /api/reservations`, `GET /api/invitations`, `POST /api/invitations/respond`)

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Zamanlama Hesaplaması (`getReservationTimingState` & `isReservationEnded`)
- **`isReservationEnded(r)` Ayrımı:** Bitiş saati (`Europe/Istanbul`) geçmiş olan `PENDING`, `CONFIRMED` veya `CHECKED_IN` kayıtları `activeList` yerine otomatik olarak `pastList` (*Geçmiş & İptal Edilenler*) sekmesine aktarılır.
- **`isHappeningNow` (No-Show Atlama Koruması):** Yalnızca durumu `CHECKED_IN` olan ve bitiş zamanı henüz dolmamış randevular için `true` döner; **"Odayı Erken Boşalt"** butonu sadece bu koşulda gösterilerek kütüphaneye gelmeden uzaktan erken çıkış yapılıp No-Show cezasından kaçılması önlenir.
- **`hasStarted` ve `cancelLocked`:** Randevu başladıysa iptal butonu gizlenir; başlangıca 60 dakikadan az kaldıysa iptal butonu kilitlenir (*"Son 1 Saat (İptal Kilitli)"*).

### B. Rol ve Ban Kısıtlamaları (`isBanned`)
- `ADMIN` ve `SUPER_ADMIN` rolleri bu sayfaya girdiğinde otomatik olarak `/admin` paneline yönlendirilir.
- Cezalı (`isBanned === true`) öğrencilerin sağ üstteki **"Oda Rezerve Et"** butonu (*"Hesap Askıda / Suspended"*) ve grup davetlerindeki **"Kabul Et"** butonu devre dışı bırakılır.

### C. 3 Sekmeli Görünüm Yapısı
1. **Aktif Rezervasyonlarım (`tab === 0`):** Süresi dolmamış `PENDING`, `CONFIRMED` ve `CHECKED_IN` randevuları ve katılımcı onay durumlarını listeler.
2. **Gelen Grup Davetleri (`tab === 1`):** 30 dakikalık onay penceresi içindeki davetleri Kabul/Red aksiyonlarıyla sunar ve yanıt sonrası `notificationsUpdated` olayını tetikler.
3. **Geçmiş & İptal Edilenler (`tab === 2`):** `COMPLETED`, `CANCELLED`, `NO_SHOW` ve bitiş saati geçmiş randevuları listeler.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/utils/dateUtils.js` (`getIstanbulNowParts`, `isReservationEnded`)
- `frontend/src/components/Navbar.jsx` & `Footer.jsx`
- `backend/src/app/api/reservations/route.js` (`GET`, `PATCH`, `DELETE`)
- `backend/src/app/api/invitations/route.js` (`GET`)
- `backend/src/app/api/invitations/respond/route.js` (`POST`)
