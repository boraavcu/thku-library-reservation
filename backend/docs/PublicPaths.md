# Context: publicPaths.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/publicPaths.js`, THKÜ Kütüphane web sitesinin `/randevu` alt dizininde (subpath) yayınlanan istemci uygulamasının temel URL'sini, kökenini (`origin`) ve tarayıcı çerez yolunu (`cookie path`) tek merkezden normalize eden yardımcı modüldür. OAuth/NextAuth geri dönüş yönlendirmelerinin, A4 kapı QR poster bağlantılarının, kurumsal e-posta giriş linklerinin ve Kiosk kilit çerezlerinin hem yerel geliştirme (`localhost:5173/randevu`) hem de canlı üretim (`https://.../randevu`) ortamında hatasız çalışmasını sağlar.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Çalışma Zamanı:** Standart Web `URL` API'si ve Node.js `process.env` (`FRONTEND_URL`, `NODE_ENV`)
- **Varsayılan Adres:** `LOCAL_FALLBACK = "http://localhost:5173/randevu"`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Alt Dizin Korumalı İstemci Taban Adresi (`getFrontendBaseUrl()`)
- `process.env.FRONTEND_URL` değerini okur ve sondaki `/` karakterlerini temizler (tanımsızsa `http://localhost:5173/randevu` kullanır).
- Değer zaten `/randevu` ile bitiyorsa olduğu gibi döndürür.
- Eğer `FRONTEND_URL` yalnızca kök alan adı olarak verilmişse (`pathname === "/"` veya `""`), sonuna otomatik olarak `/randevu` ekleyerek `${parsed.origin}/randevu` döndürür; hatalı URL biçimlerinde güvenli `LOCAL_FALLBACK` değerine döner.

### B. İstemci Köken Çözümleyicisi (`getFrontendOrigin()`)
- `getFrontendBaseUrl()` üzerinden yalnızca protokol + alan adı + port (`origin`, örn. `http://localhost:5173`) bilgisini ayrıştırır.

### C. Ortam Duyarlı Çerez Yolu (`getBrowserCookiePath()`)
- Üretim ortamında (`NODE_ENV === "production"`) çerez kapsamını ana kütüphane sitesinden izole etmek için `"/randevu"`, geliştirme ortamında ise `"/"` döndürür.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/auth/[...nextauth]/route.js`
- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/lib/staffMail.js`
