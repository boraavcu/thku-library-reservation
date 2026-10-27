# Context: reservations/active/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/reservations/active/route.js`, Öğrenci Ana Sayfasında (`Dashboard.jsx`) yer alan **"Aktif Rezervasyonlarım"** bölümünü besleyen hızlı sorgu uç noktasıdır (`GET`).

##  2. İş Mantığı ve Saat Dilimi Filtrelemesi

1. İlk olarak `await runReservationLifecycleChecks()` fonksiyonunu çalıştırarak süresi dolmuş davetleri veya Kiosk onay süresi geçmiş randevuları temizler.
2. Kullanıcının organizatör (`userId`) veya reddetmemiş katılımcı (`status: { not: "REJECTED" }`) olduğu, durumu `["PENDING", "CONFIRMED", "CHECKED_IN"]` olan randevuları çeker.
3. Türkiye saat dilimine (`Europe/Istanbul`) göre:
   - Gelecek günlere ait (`resDateStr > todayStr`) randevuları,
   - Veya bugüne ait olup bitiş saati henüz geçmemiş (`endMinutes > nowMinutes`, `23:59` gece yarısı bitişleri `1440` dk olarak hesaba katılarak) randevuları filtreler ve tarihe/saate göre sıralı döndürür.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`
- `backend/src/lib/lifecycle.js`