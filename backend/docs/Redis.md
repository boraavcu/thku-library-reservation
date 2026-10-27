# Context: redis.js

##  1. Dosyanın Amacı ve Mimari Rolü

`redis.js`, Kiosk kapı QR yoklama sisteminin anlık oturum anahtarlarını, grup yoklama kümelerini ve 4 katmanlı gizli sekme/cihaz kilitlerini bellekte (in-memory) tutan **Redis İstemci Tekilleştirme (Singleton)** modülüdür.

##  2. Bağlantı Yönetimi ve Sistemde Kullanılan Redis Anahtarları (Key Schema)

### A. Hata Toleranslı Bağlantı (`retryStrategy`)
- `process.env.REDIS_URL || "redis://localhost:6379"` adresine bağlanır.
- `maxRetriesPerRequest: 3` ve kademeli yeniden bağlanma (`Math.min(times * 50, 2000)`) stratejisi sayesinde Redis konteyneri kapalıysa sunucunun sonsuz döngüde asılı kalmasını önler.

### B. Kiosk ve Check-In Sürecinde Tutulan Redis Anahtarları
1. **`kiosk:personal_otp:${reservationId}:${userId}` (String, TTL: 600 sn):**
   - Öğrenci kapıdaki QR kodu okuttuğunda üretilen tek kullanımlık kişisel oturum doğrulama anahtarıdır (`personalSessionToken`). Onay verildiğinde `redis.del()` ile anında silinir.
2. **`kiosk:checked_users:${reservationId}` (Set, TTL: 14400 sn / 4 saat):**
   - İlgili randevu için kapı QR onayını tamamlamış grup üyelerinin `userId` değerlerini tutan kümedir (`sadd` / `smembers`). Kişi sayısı `minParticipants` (2) değerine ulaştığında oda `CHECKED_IN` olur.
3. **Gizli Sekme ve Aynı Cihaz Kilit Anahtarları (String, TTL: 14400 sn / 4 saat):**
   - `kiosk:device_lock:${reservationId}:${headerDeviceId}` (LocalStorage Cihaz ID kilidi)
   - `kiosk:hw_lock:${reservationId}:${hwLockHash}` (WebGL GPU + Ekran Donanım Parmak İzi kilidi)
   - `kiosk:ipua_lock:${reservationId}:${ipUaHash}` (IP + User-Agent kilidi)
   - Bu 3 anahtar, aynı fiziksel telefondan ikinci bir öğrencinin hesabına girilerek sahte yoklama verilmesini kesin olarak engeller.

##  3. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/lib/lifecycle.js`
- `backend/src/app/api/admin/manage/route.js`