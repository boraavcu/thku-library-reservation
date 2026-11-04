# Context: runtimePaths.js

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/runtimePaths.js`, istemci uygulamasının Apache ters vekil sunucusu (Reverse Proxy) arkasında `/randevu` alt dizini altında çalışabilmesini sağlayan merkezi çalışma zamanı yol (Path) ve URL çözümleyici modülüdür. Geliştirme (`import.meta.env.DEV`) ve üretim (`import.meta.env.PROD`) ortamları arasındaki API ve NextAuth kök dizin farklarını soyutlayarak tüm bileşenlerin tutarlı adresler üretmesini garanti eder.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **Çalışma Zamanı Ortam Değişkenleri:** Vite `import.meta.env.PROD` bayrağı
- **Tarayıcı API'leri:** `window.location.origin` (Tam nitelikli geri dönüş URL'leri oluşturmak için)

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Sabit Taban Yollar (`APP_BASE`, `API_BASE`, `AUTH_BASE`)
- **`APP_BASE = "/randevu"`:** İstemci yönlendiricisinin (`BrowserRouter`) ve statik varlıkların yayınlandığı sabit uygulama alt dizinidir.
- **`API_BASE = import.meta.env.PROD ? "/randevu/api" : "/api"`:** Üretim ortamında Apache `ProxyPass /randevu/api/` kuralıyla eşleşmesi için `/randevu/api`, yerel geliştirme ortamında ise Vite proxy üzerinden doğrudan `/api` önekini döndürür.
- **`AUTH_BASE = `${API_BASE}/auth``:** `SessionProvider` bileşeninin NextAuth oturum uç noktasına (`/randevu/api/auth` veya `/api/auth`) erişmesini sağlar.

### B. Yardımcı Yönlendirme Fonksiyonları
1. **`appPath(path = "/")`:** Verilen uygulama içi rotanın başına `/` karakterini güvenli biçimde normalize ederek `/randevu/...` tam yolunu üretir (Örn: `appPath('/dashboard')` -> `"/randevu/dashboard"`). Tam sayfa yenilemeli yönlendirmelerde (`window.location.assign` / `window.location.href`) kullanılır.
2. **`appAbsoluteUrl(path = "/")`:** `window.location.origin` ile `appPath(path)` çıktısını birleştirerek NextAuth `signIn` ve `signOut` işlemlerinde ihtiyaç duyulan mutlak geri dönüş adresini (`callbackUrl`) oluşturur.
3. **`stripAppBase(pathname = "/")`:** Sunucudan dönen yönlendirme URL'lerinin başındaki `/randevu` önekini soyarak uygulama içi saf rotayı (`/dashboard`, `/change-password` vb.) elde eder ve çift `/randevu/randevu` öneki oluşmasını önler.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/main.jsx` (`AUTH_BASE`)
- `frontend/src/api.js` (`API_BASE`)
- `frontend/src/pages/Login.jsx` (`appAbsoluteUrl`, `appPath`, `stripAppBase`)
- `frontend/src/pages/RulesAcceptance.jsx` (`appAbsoluteUrl`, `appPath`)
- `frontend/vite.config.js` (`base: '/randevu/'` yapılandırması)
