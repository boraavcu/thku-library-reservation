# Context: App.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`App.jsx`, Frontend uygulamasının ana yönlendirme (Routing) ağacını, alt alan adı (`panel.library.thk.edu.tr`) yetki kontrolünü ve global sözleşme reddi (`rulesRejected`) olay dinleyicisini barındıran kök uygulama bileşenidir.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Yönlendirme:** `react-router-dom` (`Routes`, `Route`, `Navigate`, `useNavigate`)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`)
- **Sayfa Bileşenleri:** `Login`, `RulesAcceptance`, `Dashboard`, `StudyRooms`, `ReserveForm`, `Profile`, `MyBookings`, `AdminPanel`, `Kiosk`

##  3. İş Mantığı ve Rotalar (Routing & Event Listeners)

### A. Alt Alan Adı (Subdomain) Güvenlik Kontrolü
- Kullanıcı `panel.library.thk.edu.tr` üzerinden giriş yaptıysa ancak rolü `['ADMIN', 'LIBRARIAN', 'SUPER_ADMIN']` değilse (yani öğrenciyse), `window.location.href = '[https://library.thk.edu.tr](https://library.thk.edu.tr)'` ile otomatik olarak öğrenci portalına yönlendirilir.

### B. Dinamik Sözleşme Güncelleme Dinleyicisi (`rulesRejected`)
- Yönetici yeni bir sözleşme versiyonu yayınladığında backend middleware'i (`checkRulesAcceptance.js`) `403` döndürür. `App.jsx` içindeki `rulesRejected` dinleyicisi oturumdaki `acceptedAgreementVersion` değerini sıfırlayarak kullanıcıyı anında `/rules` sayfasına yönlendirir.

### C. Uygulama Rotaları (`<Routes>`)
- `/` -> `Login.jsx` (Giriş Ekranı)
- `/rules` -> `RulesAcceptance.jsx` (Kullanım Kuralları ve Sözleşme Onayı)
- `/dashboard` -> `Dashboard.jsx` (Öğrenci Ana Kontrol Paneli)
- `/reserve` -> `StudyRooms.jsx` (Çalışma Odaları Listesi ve Filtreleme)
- `/reserve/new` -> `ReserveForm.jsx` (Saat Seçimi ve Katılımcı Ekleme Sihirbazı)
- `/bookings` -> `MyBookings.jsx` (Aktif/Geçmiş Randevular ve Grup Davetleri)
- `/profile` -> `Profile.jsx` (Kullanıcı Profili ve Telefon Güncelleme)
- `/admin` -> `AdminPanel.jsx` (Kütüphane Yönetim & Analiz Merkezi)
- `/kiosk` -> `Kiosk.jsx` (A4 Kapı QR Posteri ve Öğrenci Kapı Yoklama Ekranı)
- `*` -> Tanımsız URL'leri `/` adresine yönlendirir.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/main.jsx`
- Tüm `frontend/src/pages/*.jsx` dosyaları