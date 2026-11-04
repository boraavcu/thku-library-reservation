# Context: Navbar.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/components/Navbar.jsx`, uygulamanın tüm iç sayfalarında (`Dashboard`, `StudyRooms`, `ReserveForm`, `MyBookings`, `Profile`, `AdminPanel`) üst kısımda sabit (`sticky`) olarak konumlanan ana navigasyon, bildirim merkezi, `TR` / `EN` dil değiştirici ve kullanıcı profili çubuğudur. Kullanıcının rolüne (`STUDENT`, `LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) ve aktif görünüm moduna göre menü bağlantılarını dinamik olarak uyarlar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`, `signOut`)
- **Yönlendirme:** `react-router-dom` (`useNavigate`, `useLocation`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **API İstemcisi:** `../api` (`GET /api/invitations`, `GET /api/announcements`, `POST /api/invitations/respond`)

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Akıllı Rol ve Görünüm Modu Ayrımı (`showStaffNavbar` & `isLibrarianInStudentMode`)
1. **`ADMIN` (Kütüphane Müdürü) ve `SUPER_ADMIN` (BİM):**
   - Üst menüde öğrenci bağlantılarını görmezler; yalnızca **"Yönetim & Analiz Merkezi (`/admin`)"** ve **"Kapı QR Posteri (`/kiosk`)"** bağlantılarına erişirler.
   - `isAdminOrSuper` kontrolü sayesinde bu roller için gereksiz yere `GET /api/invitations` isteği atılmaz.
2. **`LIBRARIAN` (Kütüphane Görevlisi):**
   - Yönetim ekranlarındayken yetkili menüsünü görür; `/dashboard?studentView=true`, `/reserve` veya `/bookings` rotalarına geçtiğinde (`isLibrarianInStudentMode`) öğrenci menülerini ve **"Yönetim Merkezine Dön"** butonunu görür.
3. **`STUDENT` (Öğrenci):**
   - Standart öğrenci navigasyonunu (`NAV_LINKS`: `/dashboard`, `/reserve`, `/bookings`) kullanır.
   - *(Not: Kurumsal `@thk.edu.tr` personelinin geçici şifre sonrası zorunlu şifre belirleme işlemi `App.jsx` içindeki `RequirePasswordChanged` koruyucusu tarafından `/change-password` rotasına yönlendirilerek otomatik yürütülür).*

### B. Bildirim Merkezi ve Satır İçi Davet Yanıtlama (`localStorage` + `Dialog`)
- Kullanıcı e-postasına özel `thku_read_notifs_${email}` anahtarıyla okunmuş duyuru (`ann_${id}`) ve grup davetleri (`inv_${id}`) takip edilir; okunmamış bildirim sayısı `<Badge>` üzerinde gösterilir ve `markAllAsRead` ile sıfırlanabilir.
- Bildirime tıklandığında açılan `<Dialog>` penceresinden duyuru tam metni okunabilir veya grup daveti başka sayfaya gitmeden doğrudan **Kabul Et** / **Reddet** (`POST /api/invitations/respond`) ile yanıtlanabilir (banlı öğrenciler için Kabul Et butonu `disabled={isBanned}` ile kilitlidir).

### C. Mobil Uyumlu Profil Menüsü ve `/randevu/` Çıkış Yönlendirmesi
- Masaüstünde (`md`) yatay dizilen menü bağlantıları, mobil ekranlarda (`xs`, `sm`) sağ üstteki kullanıcı avatarı açılır menüsüne (`Menu`) taşınır.
- Profil menüsündeki **Çıkış Yap** öğesi `signOut({ callbackUrl: `${window.location.origin}/randevu/` })` çağrısıyla oturumu sonlandırır ve kullanıcıyı `/randevu/` alt dizinindeki giriş sayfasına güvenli şekilde döndürür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/App.jsx`
- `frontend/src/api.js`
- `backend/src/app/api/invitations/route.js` (`GET`)
- `backend/src/app/api/invitations/respond/route.js` (`POST`)
- `backend/src/app/api/announcements/route.js` (`GET`)
