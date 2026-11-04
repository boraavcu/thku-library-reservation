# Context: ChangePassword.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/ChangePassword.jsx`, kurumsal `@thk.edu.tr` e-posta adresine sahip kütüphane görevlisi ve yöneticilerin tek seferlik geçici şifreyle ilk giriş yaptıklarında (`mustChangePassword === true`) karşılaştıkları zorunlu kalıcı şifre belirleme sayfasıdır. Geçici şifreyle açılan oturumun uygulama içi sayfalara erişmesini engelleyerek kurumsal hesap güvenliğini sağlar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material` — `Alert`, `Box`, `Button`, `Card`, `CardContent`, `Typography`)
- **Form Bileşeni:** `../components/PasswordField` (Göster/Gizle destekli şifre alanı)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`, `signOut`)
- **Yönlendirme:** `react-router-dom` (`Navigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **API İstemcisi:** `../api` (`POST /api/account/password`)

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Erişim ve Zorunluluk Korumaları (Route Guards)
- Oturum yüklenirken (`status === 'loading'`) boş görünüm döner.
- Oturumu bulunmayan kullanıcılar (`!session?.user?.id`) doğrudan `/` giriş sayfasına yönlendirilir.
- Şifre değiştirme zorunluluğu bulunmayan (`!session.user.mustChangePassword`) kullanıcılar `/change-password` adresine manuel girseler dahi otomatik olarak `/dashboard` rotasına yönlendirilir.

### B. Şifre Doğrulama ve Oturum Yenileme Akışı
- Kullanıcıdan yeni şifre (`password`) ve şifre tekrarı (`confirm`) alınır; istemci tarafında iki alanın eşleşip eşleşmediği (`password !== confirm`) kontrol edilir.
- Sunucu tarafında (`POST /api/account/password`) güçlü parola politikası (büyük harf, küçük harf, rakam ve özel karakter içeren karmaşıklık ve minimum uzunluk doğrulaması) işletilir; olası doğrulama hataları `<Alert severity="error">` bileşeninde kullanıcıya gösterilir.
- Şifre başarıyla kaydedildiğinde form alanları temizlenir, `await signOut({ redirect: false })` ile geçici şifre oturumu sonlandırılır ve `window.location.assign(`${window.location.origin}/randevu/`)` çağrısıyla kullanıcı yeni kalıcı şifresiyle giriş yapmak üzere kurumsal giriş ekranına yönlendirilir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/App.jsx` (`/change-password` rotası ve `RequirePasswordChanged` sarmalayıcısı)
- `frontend/src/components/PasswordField.jsx`
- `frontend/src/i18n.js` (`setNewPassword`, `setNewPasswordHelp`, `passwordMismatch`, `savePasswordAndSignIn`)
- `backend/src/app/api/account/password/route.js` (`POST`)
