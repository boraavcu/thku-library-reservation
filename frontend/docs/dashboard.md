# Context: Dashboard.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/Dashboard.jsx`, öğrencilerin kurumsal hesaplarıyla giriş yapıp aktif kullanıcı sözleşmesini (`acceptedAgreementVersion`) onayladıktan sonra karşılaştıkları ana kontrol panelidir. Hızlı işlem kartlarını, `No-Show` uyarı sayacını ve ban durumunu, bekleyen grup davetlerini, aktif rezervasyonları ve öncelik filtreli kütüphane duyurularını tek bir ekranda birleştirir.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama & Yönlendirme:** `next-auth/react` (`useSession`), `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **API & Yardımcılar:** `../api` (`Axios`), `../utils/formatTime` (`formatRelativeTime`)
- **Alt Bileşenler:** `../components/Navbar`, `../components/Footer`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Erişim, Rol ve Kiosk Dönüş Korumaları (`useEffect`)
1. **Oturum ve Sözleşme Kontrolü:** Oturumu olmayanlar `/` sayfasına, aktif sözleşmeyi henüz onaylamamış kullanıcılar ise `/rules` sayfasına yönlendirilir.
2. **Yetkili Yönlendirmesi:** `ADMIN` ve `SUPER_ADMIN` doğrudan `/admin` paneline yönlendirilir; `LIBRARIAN` ise yalnızca `?studentView=true` sorgu parametresi mevcutsa bu ekranı görüntüleyebilir.
3. **Kiosk Kapı QR Dönüş Hafızası (`thku_kiosk_return_door`):** `sessionStorage` içinde bekleyen bir kapı QR anahtarı varsa kullanıcı Dashboard'da bekletilmeden doğrudan `/kiosk?door=...` yoklama ekranına yönlendirilir.

### B. Eşzamanlı Veri Çekme ve Disiplin Göstergeleri
- Sayfa açılışında `Promise.all` ile `GET /api/announcements`, `GET /api/invitations` ve `GET /api/reservations/active` uç noktaları paralel sorgulanır.
- Oturumdaki `noShowCount`, `isBanned`, `banUntil` ve `banReason` alanlarına göre sağ üstte **"No-Show Uyarısı: X / 3"** rozeti gösterilir; kullanıcı yasaklıysa sayfa tepesinde kırmızı `<Alert severity="error">` uyarısı açılır, oda rezervasyon kartı ve grup daveti kabul butonları kilitlenir.

### C. İki Sütunlu Arayüz Düzeni
- **Sol Sütun:** *Oda Rezerve Et* (`/reserve`), *Rezervasyonlarım* (`/bookings`), *Rezervasyon Kuralları* (`/rules?view=true`) hızlı aksiyon kartları, 30 dakika süreli bekleyen davet kartları ve aktif randevu listesi yer alır.
- **Sağ Sütun (Sabitlenmiş Duyuru Paneli):** Duyurular `ALL`, `IMPORTANT` (`HIGH`/`URGENT` veya sabitlenmiş) ve `NORMAL` çipleriyle filtrelenir ve `ANN_PER_PAGE = 3` sabitiyle sayfalanarak gösterilir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/components/Navbar.jsx` & `Footer.jsx`
- `frontend/src/utils/formatTime.js`
- `frontend/src/pages/Kiosk.jsx` (`thku_kiosk_return_door` entegrasyonu)
- `backend/src/app/api/announcements/route.js` (`GET`)
- `backend/src/app/api/invitations/route.js` (`GET`) & `respond/route.js` (`POST`)
- `backend/src/app/api/reservations/active/route.js` (`GET`)
