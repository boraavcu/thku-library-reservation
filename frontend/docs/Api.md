# Context: api.js

##  1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/api.js`, Frontend uygulamasının Backend API uç noktalarıyla (`/api/*`) haberleşmesini sağlayan merkezi **Axios istemcisi** ve **Donanım Parmak İzi / Ağ Güvenlik Katmanıdır**. Her HTTP isteğinin başlığına (`headers`), öğrencinin cihaz kimliğini, gizli sekmede (Incognito) ve farklı sayfa yakınlaştırma (zoom) seviyelerinde bile değişmeyen WebGL donanım parmak izini ve ağ bağlantı tipini otomatik olarak enjekte eder.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **HTTP İstemcisi:** `axios` (`baseURL: '/api'`, `withCredentials: true`)
- **Tarayıcı API'leri:** `localStorage`, `HTMLCanvasElement` (`webgl` / `WEBGL_debug_renderer_info`), `navigator.connection`, `window.screen`, `Intl.DateTimeFormat`

##  3. 3 Katmanlı Güvenlik ve Cihaz İmza Fonksiyonları

Kiosk kapı QR yoklamasında bir öğrencinin kendi telefonundan hem kendi hesabına hem de gizli sekme (Incognito) veya farklı tarayıcı açarak gelmeyen arkadaşının hesabına giriş yapıp sahte yoklama vermesini engellemek için her istekte şu 3 başlık üretilir:

1. **`getOrCreateDeviceId()` -> `x-device-id`:**
   - Tarayıcının `localStorage` alanında `thku_kiosk_device_id` anahtarıyla benzersiz bir cihaz kimliği (`dev_...`) oluşturur ve saklar.
2. **`getHardwareFingerprint()` -> `x-hardware-fp` (Gizli Sekme / Incognito & Zoom Koruması):**
   - Kullanıcı gizli sekme açıp çerezleri ve `localStorage`'ı sıfırlasa veya sayfa yakınlaştırma (zoom) oranını değiştirse bile fiziksel cihazın donanım özellikleri değişmez.
   - Bu fonksiyon cihazın **WebGL Ekran Kartı (GPU) Renderer modelini** (`UNMASKED_RENDERER_WEBGL`), yön bağımsız **ekran çözünürlüğünü ve renk derinliğini** (`Math.max(width, height) x Math.min(width, height) x colorDepth`), **CPU çekirdek sayısını** (`hardwareConcurrency`), **dokunmatik nokta sayısını** (`maxTouchPoints`), **işletim sistemi platformunu** (`navigator.platform`) ve **saat dilimini** birleştirerek hızlı **32-bit FNV-1a Hash** algoritmasıyla `hw_...` formatında sabit bir donanım imzası üretir.
3. **`getNetworkConnectionType()` -> `x-net-type` (Hücresel Veri Tespiti):**
   - `navigator.connection` üzerinden cihazın `cellular` (Mobil Veri) mi yoksa `wifi` üzerinden mi bağlandığını okuyarak backend'deki Kampüs Wi-Fi doğrulama katmanına iletir.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- Tüm Frontend sayfaları ve bileşenleri (`Dashboard`, `AdminPanel`, `Kiosk`, `ReserveForm`, `MyBookings`, `StudyRooms`, `Profile`, `RulesAcceptance`, `Navbar`, `RoomDensityChart`)
- `backend/src/lib/kioskSecurity.js` (`getCrossIncognitoSignature` fonksiyonu)
- `backend/src/app/api/kiosk/qr/route.js` ve `backend/src/app/api/checkin/validate/route.js`
