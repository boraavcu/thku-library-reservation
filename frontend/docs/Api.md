# Context: api.js

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/api.js`, istemci uygulamasının Backend API uç noktalarıyla haberleşmesini sağlayan merkezi **Axios istemcisi** ve **Cihaz / Donanım Parmak İzi Güvenlik Katmanıdır**. `runtimePaths.js` içindeki `API_BASE` sabitini kullanarak hem geliştirme (`/api`) hem de Apache `/randevu` alt dizin üretim ortamında (`/randevu/api`) doğru hedefe istek atar ve her HTTP isteğine sahte Kiosk yoklamasını önleyen güvenlik başlıklarını enjekte eder.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **HTTP İstemcisi:** `axios` (`baseURL: API_BASE`, `withCredentials: true`)
- **Çalışma Zamanı Yolları:** `./runtimePaths` (`API_BASE`)
- **Tarayıcı API'leri:** `localStorage`, `HTMLCanvasElement` (`webgl` / `experimental-webgl` ve `WEBGL_debug_renderer_info`), `navigator.connection`, `window.screen`, `Intl.DateTimeFormat`

## 3. İş Mantığı ve Bileşen Mimarisi

Kiosk kapı QR yoklamasında bir öğrencinin kendi telefonundan hem kendi hesabına hem de gizli sekme (Incognito) veya farklı tarayıcı açarak kütüphaneye gelmeyen arkadaşının hesabına giriş yapıp sahte yoklama vermesini engellemek amacıyla `api.interceptors.request` her isteğe 3 başlık ekler:

1. **`getOrCreateDeviceId()` -> `x-device-id`:**
   - Tarayıcının `localStorage` alanında `thku_kiosk_device_id` anahtarıyla benzersiz bir cihaz kimliği (`dev_...`) üretir ve saklar; depolama kapalıysa `dev_fallback_browser` döndürür.
2. **`getHardwareFingerprint()` -> `x-hardware-fp` (Gizli Sekme & Yakınlaştırma Korumalı Donanım İmzası):**
   - Gizli sekme açılsa veya yakınlaştırma (zoom) seviyesi değiştirilse dahi fiziksel cihazın değişmeyen donanım özelliklerini okur:
     - **WebGL GPU Modeli:** `UNMASKED_RENDERER_WEBGL` üzerinden ekran kartı işleyici bilgisi,
     - **Yön Bağımsız Ekran Boyutu ve Renk Derinliği:** `Math.max(width, height)xMath.min(width, height)xcolorDepth`,
     - **İşlemci, Dokunmatik ve Platform Bilgileri:** `navigator.platform`, `navigator.hardwareConcurrency`, `navigator.maxTouchPoints` ve `timeZone`.
   - Bu özellikleri **32-bit FNV-1a Hash** algoritmasıyla özetleyerek `hw_...` formatında deterministik bir donanım parmak izi üretir ve Backend'deki PostgreSQL `kiosk_device_locks` tablosu üzerinden çapraz oturum cihaz kilidi denetimine sunar.
3. **`getNetworkConnectionType()` -> `x-net-type`:**
   - `navigator.connection` API'si üzerinden bağlantının `wifi` veya `cellular` (mobil veri) olup olmadığını okuyarak kampüs ağı doğrulama katmanına iletir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/runtimePaths.js` (`API_BASE`)
- Tüm `frontend/src/pages/*.jsx` ve `frontend/src/components/*.jsx` bileşenleri
- `backend/src/lib/kioskSecurity.js` (PostgreSQL `kiosk_device_locks` cihaz kilidi ve ağ doğrulaması)
- `backend/src/app/api/kiosk/qr/route.js` & `backend/src/app/api/checkin/validate/route.js`
