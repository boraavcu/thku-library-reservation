# Context: PasswordField.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/components/PasswordField.jsx`, şifre girişi gerektiren ekranlarda (`Login.jsx` ve `ChangePassword.jsx`) kullanılan, erişilebilirlik (WAI-ARIA) standartlarına uygun ve Göster/Gizle (`Visibility` / `VisibilityOff`) düğmesi barındıran yeniden kullanılabilir Material-UI şifre giriş bileşenidir.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **React:** `useState` (Yerel görünürlük durumu yönetimi)
- **UI Framework:** Material-UI (`@mui/material` — `TextField`, `InputAdornment`, `IconButton`)
- **İkonlar:** `@mui/icons-material/Visibility`, `@mui/icons-material/VisibilityOff`

## 3. İş Mantığı ve Bileşen Mimarisi

- **Görünürlük Anahtarı (`visible`):** Varsayılan olarak `type="password"` modunda başlar; sağ uçtaki (`InputAdornment position="end"`) ikon butonuna tıklandığında `type="text"` ile `type="password"` arasında anlık geçiş yapar.
- **Erişilebilirlik ve Güvenlik Nitelikleri:**
  - Ekran okuyucular için dinamik `aria-label={visible ? hideLabel : showLabel}` (varsayılan Türkçe `'Şifreyi göster'` / `'Şifreyi gizle'`, çoklu dilde `i18n` üzerinden özelleştirilebilir) ve `aria-pressed={visible}` niteliklerini sunar.
  - Tarayıcı yazım denetiminin şifre metnini işlemesini önlemek adına `spellCheck={false}` sabit olarak tanımlanmıştır.
  - `readOnly` desteği ve `...props` aktarımı sayesinde tüm standart MUI `TextField` özellikleriyle (`size`, `fullWidth`, `required`, `autoComplete` vb.) tam uyumlu çalışır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Login.jsx` (Kurumsal `@thk.edu.tr` personel şifre girişi)
- `frontend/src/pages/ChangePassword.jsx` (Yeni şifre ve yeni şifre tekrar alanları)
