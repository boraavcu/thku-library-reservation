# Context: main.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/main.jsx`, React 19 istemci uygulamasının DOM üzerindeki `#root` düğümüne bağlandığı (mount edildiği) giriş noktasıdır (Entry Point). Uygulamayı `/randevu` alt dizin mimarisine uyumlu kimlik doğrulama oturumu, yönlendirici ve kurumsal Material-UI tema sağlayıcılarıyla sarmalar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **Çekirdek:** `react`, `react-dom/client`
- **Kimlik Doğrulama Sağlayıcısı:** `next-auth/react` (`SessionProvider`)
- **İstemci Yönlendiricisi:** `react-router-dom` (`BrowserRouter`)
- **Tasarım Sistemi:** `@mui/material` (`ThemeProvider`, `CssBaseline`), `./theme`
- **Alt Dizin & Çoklu Dil Yapılandırması:** `./runtimePaths` (`AUTH_BASE`), `./i18n`

## 3. İş Mantığı ve Bileşen Mimarisi

Uygulama dıştan içe doğru 4 sağlayıcı katmanıyla sarmalanır:
1. **`<React.StrictMode>`:** Geliştirme aşamasında olası yan etkileri ve uyumsuz yaşam döngüsü kullanımlarını denetler.
2. **`<SessionProvider basePath={AUTH_BASE}>`:** `runtimePaths.js` içinden gelen `AUTH_BASE` (üretimde `/randevu/api/auth`, geliştirmede `/api/auth`) adresini kullanarak NextAuth oturum bilgisini tüm alt bileşenlere dağıtır.
3. **`<BrowserRouter basename="/randevu">`:** Uygulamanın Apache altında `/randevu` alt dizininde (`APP_BASE`) sorunsuz çalışmasını sağlar; tüm `navigate('/dashboard')` çağrılarını tarayıcı adres çubuğunda `/randevu/dashboard` olarak çözümler.
4. **`<ThemeProvider theme={theme}>` & `<CssBaseline />`:** Tarayıcı varsayılan CSS sıfırlamasını uygular ve `theme.js` içindeki kurumsal renk paleti ile tipografiyi tüm MUI bileşenlerine aktarır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/index.html`
- `frontend/src/runtimePaths.js`
- `frontend/src/App.jsx`
- `frontend/src/theme.js`
- `frontend/src/i18n.js`
