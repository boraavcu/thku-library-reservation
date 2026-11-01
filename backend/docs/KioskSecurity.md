## 1. Dosyanın Amacı ve Mimari Rolü

`kioskSecurity.js`, oda kapılarındaki tabletlerde gösterilen dinamik QR kodlarının ve öğrencilerin mobil cihazlarından verdikleri yoklama onaylarının **fiziksel ve kriptografik güvenliğini** yönetir. Öğrencilerin odaya gelmeden uzaktan yoklama vermesini (proxy attendance), ekran görüntüsü paylaşımını ve kampüs Eduroam Wi-Fi ağındaki IP çakışmalarını engelleyen 4 katmanlı bir savunma hattı sunar.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Kriptografi:** Node.js yerleşik `crypto` modülü (`createHmac`, `randomBytes`, `timingSafeEqual`, `createHash`).
- **Önbellek & Donanım Kilidi:** `@/lib/redis` (Dinamik token TTL'leri ve `kiosk:devlock` anahtarları).
- **Çevre Değişkeni:** `process.env.KIOSK_SECRET_KEY` (HMAC imzalama gizli anahtarı).

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. 30 Saniyelik Dinamik QR Token Üretimi (`generateKioskToken`)
- Tablet ekranının her 30 saniyede bir tazelediği QR kod içeriğini üretir.
- **Yük:** `{ token: <randomHex>, timestamp: <epochMs>, roomId: <id>, signature: <hmacSha256> }`.
- İmza formülü: `HMAC_SHA256(roomId + ":" + timestamp, KIOSK_SECRET_KEY)`.

### B. Zaman ve İmza Doğrulaması (`verifyKioskSignature`)
- Mobil cihazdan gelen QR yükünün imzasını zamanlama saldırılarına karşı güvenli (`timingSafeEqual`) yöntemle test eder.
- Zaman damgasının güncel olduğunu denetler (`Math.abs(now - timestamp) <= 30000ms`). 30 saniyeden eski ekran görüntüleri doğrudan reddedilir.

### C. Tek Kullanımlık Token Tüketimi ve Anti-Replay (`consumeKioskToken`)
- QR kod telefona okutulduğu anda Redis üzerinde `SET kiosk:token:<token> 1 EX 60 NX` komutu işletilir.
- Aynı token ikinci kez gönderilirse sistem `"Bu QR kod zaten kullanıldı veya süresi doldu"` hatası verir.

### D. Eduroam Wi-Fi Uyumlu Cihaz Kilidi (`enforceDeviceCheckinLock`)
- **Kampüs Wi-Fi NAT Çözümü:** Kampüsteki tüm öğrenciler aynı dış IP adresini paylaşır ve benzer telefon modelleri (ör. iPhone Safari) aynı User-Agent'ı üretir.
- Eski IP+UA kilitlerinin aynı sınıftaki farklı öğrencileri bloklamasını önlemek için kilit, tarayıcıya bırakılan benzersiz çerez (`kiosk_device_token`), `x-device-id` başlığı ve donanım parmak izinin (`x-hardware-fp`) birleşimiyle üretilen `hwLockHash` üzerinden çalışır.
- Bir öğrenci kapıda QR okuttuğunda ilgili cihaz rezervasyon süresi boyunca kilitlenir; aynı telefondan başka bir öğrenci adına yoklama verilemez.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/kiosk/qr/route.js` (Tablet uç noktası)
- `backend/src/app/api/checkin/validate/route.js` (Mobil doğrulama uç noktası)
- `backend/src/lib/redis.js`