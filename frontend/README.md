# THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi — Frontend (İstemci Uygulaması)

Bu dizin, **Türk Hava Kurumu Üniversitesi (THKÜ) Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi**'nin öğrenci portalını, Kiosk kapı QR yoklama ekranını ve kütüphane yönetim/analitik merkezini barındıran tek sayfa (SPA) istemci uygulamasıdır.

---

## 1. Teknoloji Yığını

| Katman | Teknoloji / Kütüphane | Açıklama |
| :--- | :--- | :--- |
| **Çekirdek Çatı** | React `19.2` + Vite `7.2` | Hızlı geliştirme sunucusu ve optimize edilmiş statik üretim derlemesi (`frontend/dist`) |
| **Tasarım Sistemi** | Material-UI (`@mui/material` `v7.3`, `@emotion/*`) | Kurumsal renk paleti (`src/theme.js`), duyarlı (responsive) ızgara ve A4 yazdırma (`@media print`) desteği |
| **Yönlendirme** | `react-router-dom` `v7.13` | `basename="/randevu"` ile alt dizin uyumlu istemci taraflı yönlendirme |
| **Kimlik Doğrulama** | `next-auth/react` `v4.24` | Microsoft Entra ID (`azure-ad`), kurumsal personel şifresi (`staff-login`) ve test modu (`demo-login`) oturum yönetimi |
| **HTTP & Güvenlik** | `axios` `v1.13` (`src/api.js`) | `x-device-id`, WebGL donanım parmak izi (`x-hardware-fp`) ve ağ tipi (`x-net-type`) enjeksiyonu |
| **Çoklu Dil (i18n)** | `i18next` + `react-i18next` | Türkçe (`tr`) ve İngilizce (`en`) tam kapsamlı anlık dil değişimi |
| **Veri Görselleştirme** | MUI Özel Analitik Bileşenleri & `recharts` | Oda yoğunluk sütun grafiği, bölüm dağılımı ve 7/24 saatlik yoğunluk ısı haritası |

---

## 2. `/randevu` Alt Dizin Mimarisi (`vite.config.js` & `runtimePaths.js`)

Uygulama, kurumsal web sunucusunda kök dizin (`/`) yerine **`/randevu`** alt dizini altında çalışacak şekilde tasarlanmıştır:

1. **Derleme ve Vekil Yapılandırması (`vite.config.js`):**
   - `base: '/randevu/'` ayarı sayesinde tüm statik JS/CSS varlık yolları `/randevu/assets/...` önekiyle üretilir.
   - Yerel geliştirme sırasında `/randevu/api` ve `/api` istekleri Vite proxy üzerinden yerel Backend sunucusuna (`http://localhost:3000`) aktarılır.
2. **Çalışma Zamanı Yol Çözümleyicisi (`src/runtimePaths.js`):**
   - `APP_BASE = "/randevu"`: `<BrowserRouter basename="/randevu">` ile tüm uygulama içi rotaları `/randevu/...` altında çalıştırır.
   - `API_BASE`: Geliştirme modunda `"/api"`, üretim derlemesinde (`import.meta.env.PROD`) ise Apache `ProxyPass` kuralıyla eşleşen `"/randevu/api"` değerini alır.
   - `AUTH_BASE`: `<SessionProvider basePath={AUTH_BASE}>` üzerinden NextAuth oturum isteklerini doğru alt dizine yönlendirir.
   - `appPath`, `appAbsoluteUrl` ve `stripAppBase`: OAuth geri dönüş adreslerini (`callbackUrl`) ve tam sayfa yönlendirmelerini çift önek oluşturmadan güvenli biçimde üretir.

---

## 3. Kurulum ve Çalıştırma Komutları

### A. Bağımlılıkların Yüklenmesi
```bash
cd frontend
npm install
```

### B. Yerel Geliştirme Ortamı (`npm run dev`)
*(Backend servisinin `http://localhost:3000` üzerinde çalışır durumda olması gerekir.)*
```bash
npm run dev
```
- Uygulama yerel olarak **`http://localhost:5173/randevu/`** adresinde açılır.
- Geliştirme ortamında demo hızlı giriş panelini kapatmak için istemci ortam değişkeninde `VITE_ENABLE_DEMO_LOGIN=false` tanımlanabilir.

### C. Üretim Derlemesi (`npm run build`)
```bash
npm run build
```
- Statik üretim dosyaları **`frontend/dist`** dizinine oluşturulur.
- **Önemli:** Canlı sunucuda `npm run dev` veya `npm run preview` (`vite preview`) **kullanılmaz**; `frontend/dist` klasörü doğrudan Apache HTTP Server (`Alias /randevu`) tarafından sunulur. Sunucu kurulum adımları için [`../deploy/README.md`](../deploy/README.md) kılavuzuna bakınız.

### D. Kod Kalitesi Denetimi (`npm run lint`)
```bash
npm run lint
```

---

## 4. Klasör Yapısı

```text
frontend/
├── docs/                        # Tüm sayfa, bileşen ve yardımcıların teknik dokümantasyonu
├── src/
│   ├── components/
│   │   ├── admin/               # Yönetim paneli alt sekmeleri (Analytics, Reservations, Rooms, Users, RulesAndLogs vb.)
│   │   ├── dashboard/           # Günlük oda yoğunluk grafiği (RoomDensityChart.jsx)
│   │   ├── Footer.jsx           # Kurumsal alt bilgi bileşeni
│   │   ├── Navbar.jsx           # Rol duyarlı üst menü ve bildirim merkezi
│   │   └── PasswordField.jsx    # Erişilebilir göster/gizle şifre alanı
│   ├── pages/                   # Uygulama ekranları (Login, ChangePassword, Dashboard, Kiosk, AdminPanel vb.)
│   ├── utils/                   # Europe/Istanbul tarih motoru (dateUtils.js) ve göreceli zaman (formatTime.js)
│   ├── api.js                   # Merkezi Axios istemcisi ve donanım parmak izi katmanı
│   ├── App.jsx                  # Ana yönlendirme ağacı ve RequirePasswordChanged koruması
│   ├── i18n.js                  # TR / EN çeviri sözlüğü
│   ├── main.jsx                 # Uygulama giriş noktası (SessionProvider, BrowserRouter, ThemeProvider)
│   ├── runtimePaths.js          # /randevu alt dizin yol çözümleyicileri
│   └── theme.js                 # Kurumsal MUI v7 tasarım sistemi
└── vite.config.js               # Vite alt dizin (base: '/randevu/') ve yerel proxy ayarları
```

---

## 5. Detaylı Teknik Dokümantasyon

Her bir sayfanın, yönetim sekmesinin ve yardımcı modülün detaylı mimari açıklamaları için **[`frontend/docs/README.md`](./docs/README.md)** indeks dosyasını inceleyebilirsiniz.
