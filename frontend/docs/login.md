# Context: Login.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/Login.jsx`, uygulamanın kök rotasında (`/`, canlı ortamda `/randevu/`) çalışan kurumsal kimlik doğrulama ve giriş kapısıdır. Öğrencilerin Microsoft Entra ID (Azure AD) hesaplarıyla, kurumsal personelin (`@thk.edu.tr`) e-posta ve şifreleriyle güvenli giriş yapmasını sağlar; ayrıca test ve sunum ortamları için `VITE_ENABLE_DEMO_LOGIN` değişkeniyle kontrol edilen **"Demo Hızlı Giriş"** panelini barındırır.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Bileşenler & Yardımcılar:** `../components/PasswordField`, `../runtimePaths` (`appAbsoluteUrl`, `appPath`, `stripAppBase`)
- **Kimlik Doğrulama:** `next-auth/react` (`signIn`)
- **Yönlendirme:** `react-router-dom` (`useSearchParams`)
- **Çoklu Dil (i18n):** `react-i18next` (Sağ üst köşede anlık `TR` / `EN` dil değiştirme butonu)

## 3. İş Mantığı ve Bileşen Mimarisi

### A. 3 Katmanlı Kimlik Doğrulama Yöntemleri
1. **Microsoft Entra ID Kurumsal SSO (`signIn('azure-ad')`):**
   - Öğrenciler (`@stu.thk.edu.tr`) ve Microsoft SSO kullanan personel için birincil giriş yöntemidir.
   - `callbackUrl: appAbsoluteUrl(getPostLoginTargetPath())` ile `/randevu` alt dizinine tam uyumlu geri dönüş URL'i üretir.
   - URL'de `?error=` parametresi yakalandığında (`oauthError`), yerel test ortamında Azure AD anahtarlarının tanımlı olmadığına dair bilgilendirici `<Alert severity="warning">` uyarısı gösterir.
2. **Kurumsal `@thk.edu.tr` Personel Şifre Girişi (`signIn('staff-login')`):**
   - Yalnızca `@thk.edu.tr` uzantılı kurumsal personel adreslerini kabul eder; `@stu.thk.edu.tr` öğrenci adreslerini istemci tarafında anında reddeder.
   - `redirect: false` ile çağrılarak sayfa yenilenmeden satır içi (inline) hata yönetimi yapar:
     - `RATE_LIMITED` / `CokFazlaDeneme`: Çok fazla başarısız giriş denemesinde bekleme uyarısı gösterir.
     - `SERVICE_UNAVAILABLE` / `GirisServis`: Veritabanı/servis erişim sorunlarını bildirir.
     - Hatalı kimlik bilgisi veya süresi dolmuş (48 saat) geçici şifre durumlarında açıklayıcı hata mesajı sunar.
   - Giriş başarılı olduğunda (`res?.ok`), `stripAppBase` ve `window.location.assign(appPath(dest))` ile tarayıcı oturumu tazelenerek hedef sayfaya (ilk girişte `/change-password` veya `/admin`) yönlendirilir.
3. **Ortam Değişkeni Kontrollü Demo Giriş Paneli (`signIn('demo-login')`):**
   - `import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false'` koşuluna bağlıdır. Canlı ortamda `VITE_ENABLE_DEMO_LOGIN=false` yapıldığında tek satır kod silinmeden tüm demo hesap butonları arayüzden kalkar.
   - Test ortamında 7 öğrenci (`DEMO_ACCOUNTS`), `LIBRARIAN`, `ADMIN` ve `SUPER_ADMIN` profilleriyle `redirect: false` ve `window.location.assign(appPath(targetPath))` üzerinden hızlı geçiş sağlar.

### B. Kiosk Kapı QR Dönüş Hafızası (`getPostLoginTargetPath`)
- Oturumu açık olmayan bir öğrenci kapıdaki fiziksel QR kodu okuttuğunda `Kiosk.jsx` tarafından `sessionStorage` içine kaydedilen `thku_kiosk_return_door` anahtarı okunur.
- Anahtar mevcutsa giriş sonrası hedef rota `/dashboard` yerine otomatik olarak `/kiosk?door=...` olarak belirlenir; böylece öğrenci giriş yapar yapmaz doğrudan kapı yoklama onay ekranına döner.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/runtimePaths.js`
- `frontend/src/components/PasswordField.jsx`
- `frontend/src/pages/Kiosk.jsx` (`thku_kiosk_return_door` oturum hafızası)
- `frontend/src/i18n.js`
- `backend/src/lib/auth.js` & `backend/src/app/api/auth/[...nextauth]/route.js` (`azure-ad`, `staff-login`, `demo-login`)
