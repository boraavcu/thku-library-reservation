# Context: Footer.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`Footer.jsx`, uygulamanın tüm sayfalarının en altında (`mt: 'auto'`) yer alan kurumsal alt bilgi bileşenidir. Üniversite logosunu, Bilgi İşlem Müdürlüğü (THKÜ BİM) telif bilgisini, rol duyarlı hızlı bağlantıları ve geliştirici (Developer) LinkedIn profil rozetini barındırır.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material/LinkedIn`)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`)
- **Yönlendirme:** `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN`)

##  3. İş Mantığı ve Tasarım Detayları

1. **Sol Blok (Kurumsal Kimlik):** THKÜ resmi logosu, üniversite adı (*Türk Hava Kurumu Üniversitesi* / *University of Turkish Aeronautical Association*) ve `© 2026 Tüm Hakları Saklıdır • Bilgi İşlem Müdürlüğü (THKÜ BİM)` ibaresi yer alır.
2. **Orta Blok (Rol Duyarlı Hızlı Bağlantılar):**
   - **Kullanım Kuralları (`Terms of Use & Rules`):** Tıklandığında kullanıcıyı `/rules?view=true` (salt okunur sözleşme görünümü) sayfasına yönlendirir.
   - **Portal Bağlantısı:** Kullanıcının rolü yetkiliyse (`isStaff`) **"Yönetim Merkezi (` /admin `)"**, öğrenciyse **"Çalışma Odası Portalı (` /dashboard `)"** olarak dinamik isim alır ve ilgili sayfaya yönlendirir.
3. **Sağ Blok (Geliştirici İmza Rozeti):**
   - `<Chip component="a" href="[https://www.linkedin.com/in/bora-avcu-b75a26204/](https://www.linkedin.com/in/bora-avcu-b75a26204/)" target="_blank">` yapısıyla **"Developed By: Bora Avcu"** rozetini sunar ve tıklandığında yeni sekmede geliştiricinin LinkedIn profilini açar.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`, `AdminPanel.jsx`, `MyBookings.jsx`, `StudyRooms.jsx`, `Profile.jsx`, `RulesAcceptance.jsx`