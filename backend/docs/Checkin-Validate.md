# Context: checkin/validate/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/checkin/validate/route.js`, öğrencinin kapıdaki QR kodu okutup `Kiosk.jsx` ekranındaki **"Oda Girişimi Onayla (Check-In)"** butonuna bastığında çalışan nihai yoklama onay ve oda açılış uç noktasıdır (`POST`).

##  2. İş Mantığı, Cihaz Kilitleme ve 2. Kişi Onay Kuralı

1. **Güvenlik ve Zaman Penceresi Tekrar Doğrulaması:**
   - İstek geldiğinde mobil veri (`cellular`), VPN, 1 km GPS yarıçapı ve `getReservationKioskWindow` (±`toleranceMinutes` dk) penceresi POST aşamasında da tekrar doğrulanır.
2. **Tek Kullanımlık Oturum Anahtarı (`personalSessionToken`) Tüketimi:**
   - Redis'teki `kiosk:personal_otp:${reservation.id}:${currentUserId}` anahtarı kontrol edilir; eşleşiyorsa `redis.del()` ile anında silinir (Replay Attack koruması).
3. **4 Katmanlı Cihaz Kilidinin Mühürlenmesi (`DEVICE_LOCK_TTL = 14400` sn):**
   - Onay veren öğrencinin cihazı 4 saat boyunca bu randevu için sadece kendi `userId` değerine kilitlenir:
     - Redis'te `kiosk:device_lock`, `kiosk:hw_lock` (WebGL GPU imzası) ve `kiosk:ipua_lock` anahtarları yazılır.
     - Tarayıcıya `httpOnly: true` özellikli `thku_checkin_lock_${reservation.id}` çerezi basılır.
4. **Grup Yoklama Kümesi ve En Az 2 Kişi (`minCheckinParticipants`) Kuralı:**
   - Öğrencinin kimliği Redis'teki `kiosk:checked_users:${reservation.id}` kümesine (`sadd`) eklenir ve `AuditLog` tablosuna `RESERVATION_CHECKED_IN` kaydı düşülür.
   - **Kritik Kural:** Eğer onaylayan kişi sayısı henüz `minCheckinParticipants` (varsayılan 2) sayısına ulaşmadıysa (yani sadece 1. kişi okuttuysa), randevu durumu `CONFIRMED` olarak kalır ve Kütüphane Müdürüne mail gitmez.
   - Onaylayan üye sayısı `>= minCheckinParticipants` olduğu anda (`transition.count === 1`), randevu durumu veritabanında **`CHECKED_IN`** olarak güncellenir (`checkedInAt: now`) ve `sendKioskCheckInEmailToStaff` ile Kütüphane Müdürüne **"[Randevu Başladı - Kiosk Onaylandı]"** e-postası gönderilir.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Kiosk.jsx`
- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/lib/lifecycle.js`