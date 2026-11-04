# Context: App.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/App.jsx`, istemci uygulamasının ana yönlendirme (`Routes`) ağacını, ilk girişte zorunlu şifre değiştirme korumasını (`RequirePasswordChanged`), yönetim alt alan adı (`panel.library.thk.edu.tr`) yetki denetimini ve global sözleşme yenileme (`rulesRejected`) olay dinleyicisini barındıran kök bileşendir.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **Yönlendirme:** `react-router-dom` (`Routes`, `Route`, `Navigate`, `useNavigate`)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`)
- **Sayfa Bileşenleri:** `Login`, `ChangePassword`, `RulesAcceptance`, `Dashboard`, `StudyRooms`, `ReserveForm`, `Profile`, `MyBookings`, `AdminPanel`, `Kiosk`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Zorunlu Şifre Değiştirme Sarmalayıcısı (`RequirePasswordChanged`)
- Kurumsal personel (`@thk.edu.tr`) tek seferlik geçici şifreyle giriş yaptığında oturumdaki `session.user.mustChangePassword` bayrağı `true` gelir.
- `RequirePasswordChanged` sarmalayıcısı `/rules`, `/dashboard`, `/reserve`, `/reserve/new`, `/profile`, `/bookings`, `/admin` ve `/kiosk` rotalarının tamamını korur; kullanıcı kalıcı şifresini belirleyene kadar tüm iç rotaları `<Navigate to="/change-password" replace />` ile zorunlu şifre güncelleme ekranına yönlendirir.

### B. Alt Alan Adı Güvenliği ve Sözleşme Dinleyicisi
- **Subdomain Koruması:** `panel.library.thk.edu.tr` üzerinden erişen kullanıcının rolü `['ADMIN', 'LIBRARIAN', 'SUPER_ADMIN']` listesinde değilse `https://library.thk.edu.tr` adresine yönlendirilir.
- **Dinamik Sözleşme Yenileme (`rulesRejected`):** Yeni bir kullanıcı sözleşmesi versiyonu yayınlandığında tetiklenen `rulesRejected` pencere olayı yakalanarak `update({ acceptedAgreementVersion: null })` çalıştırılır ve kullanıcı anında `/rules` sayfasına yönlendirilir.

### C. Uygulama Rotaları (`<Routes>`)
- `/` -> `Login.jsx` (Kurumsal Giriş Ekranı)
- `/change-password` -> `ChangePassword.jsx` (Geçici Şifre Sonrası Zorunlu Kalıcı Şifre Belirleme)
- `/rules` -> `RulesAcceptance.jsx` (Kullanım Kuralları ve Sözleşme Onayı)
- `/dashboard` -> `Dashboard.jsx` (Öğrenci Ana Kontrol Paneli)
- `/reserve` -> `StudyRooms.jsx` (Çalışma Odaları Listesi ve Filtreleme)
- `/reserve/new` -> `ReserveForm.jsx` (Saat Seçimi ve Katılımcı Ekleme Sihirbazı)
- `/bookings` -> `MyBookings.jsx` (Aktif/Geçmiş Randevular ve Grup Davetleri)
- `/profile` -> `Profile.jsx` (Kullanıcı Profili ve İletişim Bilgisi Güncelleme)
- `/admin` -> `AdminPanel.jsx` (Kütüphane Yönetim & Analiz Merkezi)
- `/kiosk` -> `Kiosk.jsx` (A4 Kapı QR Posteri ve Öğrenci Kapı Yoklama Ekranı)
- `*` -> Tanımsız adresleri `/` rotasına yönlendirir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/main.jsx`
- `frontend/src/pages/ChangePassword.jsx`
- Tüm `frontend/src/pages/*.jsx` sayfa bileşenleri
