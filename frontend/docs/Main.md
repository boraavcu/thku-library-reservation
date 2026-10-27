# Context: main.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`main.jsx`, React uygulamasının DOM'a (`#root`) bağlandığı (mount edildiği) giriş noktasıdır (Entry Point). Uygulamayı kimlik doğrulama oturumu, yönlendirici ve kurumsal tema sağlayıcılarıyla sarmalar.

##  2. Teknoloji Yığını ve Sağlayıcı Katmanları (Providers)

Uygulama dıştan içe doğru şu 4 katmanla sarmalanır:
1. **`<React.StrictMode>`:** Geliştirme aşamasında olası yan etkileri ve eski API kullanımlarını denetler.
2. **`<SessionProvider basePath="/api/auth">` (`next-auth/react`):** Vite proxy üzerinden Backend'deki NextAuth oturumunu (`/api/auth/session`) tüm alt bileşenlere dağıtır.
3. **`<BrowserRouter>` (`react-router-dom`):** İstemci taraflı (SPA) sayfa yönlendirmelerini yönetir.
4. **`<ThemeProvider theme="{theme}">` & `<CssBaseline/>` (`@mui/material`):** Tarayıcı varsayılan CSS sıfırlamasını yapar ve `theme.js` içindeki kurumsal renk/tipografi tasarımını tüm MUI bileşenlerine uygular.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/index.html`
- `frontend/src/App.jsx`
- `frontend/src/theme.js`
- `frontend/src/i18n.js`