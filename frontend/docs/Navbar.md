# Context: Navbar.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`Navbar.jsx`, uygulamanın tüm iç sayfalarında (`Dashboard`, `StudyRooms`, `ReserveForm`, `MyBookings`, `Profile`, `AdminPanel`) üst kısımda sabit (`sticky`) olarak yer alan ana navigasyon, bildirim merkezi, dil değiştirici ve kullanıcı profili çubuğudur. Kullanıcının rolüne (`STUDENT`, `LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) ve o an bulunduğu sayfaya göre menü bağlantılarını dinamik olarak adapte eder.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`, `signOut`)
- **Yönlendirme:** `react-router-dom` (`useNavigate`, `useLocation`)
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN` anlık dil değişimi)
- **API İstemcisi:** `../api` (`GET /api/invitations`, `GET /api/announcements`, `POST /api/invitations/respond`)

##  3. İş Mantığı, Rol Bazlı Menü ve Bildirim Yönetimi

### A. Akıllı Rol ve Görünüm Modu Ayrımı (`showStaffNavbar` & `isLibrarianInStudentMode`)
Sistemde 4 farklı rol bulunduğu için Navbar menüsü şu kurallarla şekillenir:
1. **`ADMIN` (Kütüphane Müdürü) ve `SUPER_ADMIN` (BİM):**
   - Hiçbir sayfada (`/profile` ve `/rules` dahil) öğrenci menülerini (*Ana Sayfa*, *Çalışma Odaları*, *Rezervasyonlarım*) görmezler.
   - Üst menüde yalnızca **"Yönetim & Analiz Merkezi (` /admin `)"** ve **"Kapı QR Posteri (` /kiosk `)"** bağlantılarını görürler.
   - Ayrıca `isAdminOrSuper` kontrolü sayesinde müdür ve BİM hesapları için gereksiz yere `GET /api/invitations` (öğrenci grup daveti) sorgusu atılmaz.
2. **`LIBRARIAN` (Kütüphane Görevlisi):**
   - `/admin`, `/profile`, `/kiosk` ve `/rules` sayfalarındayken **Yetkili Navbar'ını** görür.
   - Yalnızca yönetim panelindeki *"Öğrenci Ekranı (Rezervasyon Yap)"* butonuna basıp `/dashboard`, `/reserve` veya `/bookings` sayfalarına geçtiğinde (`isLibrarianInStudentMode === true`) öğrenci menülerini ve yanında **"Yönetim Merkezine Dön"** butonunu görür.
3. **`STUDENT` (Öğrenci):**
   - Standart öğrenci navigasyonunu (`NAV_LINKS`: `/dashboard`, `/reserve`, `/bookings`) görür.

### B. Okunmuş/Okunmamış Bildirim Merkezi ve Pop-up Modalı (`localStorage` + `Dialog`)
- Kullanıcının e-postasına özel bir `localStorage` anahtarı (`thku_read_notifs_${email}`) tutularak hangi duyuruların (`ann_${id}`) ve hangi grup davetlerinin (`inv_${id}`) okunduğu takip edilir.
- Bildirim zili üzerindeki kırmızı `<Badge>` yalnızca okunmamış (`unreadCount`) bildirim sayısını gösterir; **"Tümünü okundu işaretle (`markAllAsRead`)"** butonuyla tek tıkla sıfırlanabilir.
- Bildirim menüsündeki bir öğeye tıklandığında (`handleOpenNotifDetail`), öğe okundu işaretlenir ve ekranda detay modalı (`<Dialog>`) açılır:
  - Bildirim bir **Duyuru (`ANNOUNCEMENT`)** ise tam metni okunur.
  - Bildirim bir **Grup Daveti (`INVITATION`)** ise öğrenci başka sayfaya gitmeye gerek kalmadan doğrudan açılan pop-up içinden **"Kabul Et"** veya **"Reddet"** butonuna basarak daveti yanıtlayabilir (`handleRespondFromModal`).

### C. Mobil Uyumluluk (Responsive Profile Dropdown)
- Masaüstünde (`md`) orta kısımda görünen navigasyon butonları, mobil ekranlarda (`xs`, `sm`) ekranı sıkıştırmamak için gizlenir ve sağ üstteki kullanıcı avatarına tıklandığında açılan profil menüsünün içine (`display: { xs: 'flex', md: 'none' }`) otomatik olarak yerleşir.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/invitations/route.js` (`GET`)
- `backend/src/app/api/invitations/respond/route.js` (`POST`)
- `backend/src/app/api/announcements/route.js` (`GET`)