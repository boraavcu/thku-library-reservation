# Context: Footer.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/components/Footer.jsx`, uygulamanın tüm sayfalarının alt kısmında (`mt: 'auto'`) yer alan kurumsal alt bilgi bileşenidir. Üniversite logosunu, Bilgi İşlem Müdürlüğü (THKÜ BİM) telif bilgisini, rol duyarlı hızlı bağlantıları ve geliştirici iletişim rozetini sunar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material/LinkedIn`)
- **Kimlik Doğrulama & Yönlendirme:** `next-auth/react` (`useSession`), `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)

## 3. İş Mantığı ve Bileşen Mimarisi

1. **Sol Blok (Kurumsal Kimlik):** THKÜ resmi logosunu, üniversite adını (*Türk Hava Kurumu Üniversitesi* / *University of Turkish Aeronautical Association*) ve `© 2026 Tüm Hakları Saklıdır • Bilgi İşlem Müdürlüğü (THKÜ BİM)` telif metnini barındırır.
2. **Orta Blok (Rol Duyarlı Hızlı Bağlantılar):**
   - **Kullanım Kuralları:** Kullanıcıyı salt okunur sözleşme ekranına (`/rules?view=true`) yönlendirir.
   - **Portal Bağlantısı:** Kullanıcının rolü yetkiliyse (`isStaff`: `LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) **"Yönetim Merkezi (`/admin`)"**, öğrenciyse **"Çalışma Odası Portalı (`/dashboard`)"** olarak dinamik etiketlenir.
3. **Sağ Blok (Geliştirici Rozeti):** Tıklanabilir MUI `<Chip component="a">` yapısıyla geliştirici LinkedIn profil bağlantısını yeni sekmede (`noopener noreferrer`) açar.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`, `AdminPanel.jsx`, `MyBookings.jsx`, `StudyRooms.jsx`, `Profile.jsx`, `RulesAcceptance.jsx`
