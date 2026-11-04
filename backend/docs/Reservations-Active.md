# Context: reservations/active/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/reservations/active/route.js`, Öğrenci Ana Sayfasında (`Dashboard.jsx`) yer alan **"Aktif Rezervasyonlarım"** bölümünü besleyen hızlı sorgu uç noktasıdır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`, `Reservation`)
- **Zaman & Yaşam Döngüsü:** `@/lib/timeUtils` (`getIstanbulTimeDetails`, `parseReservationMinutesUTC`) & `@/lib/lifecycle` (`runReservationLifecycleChecks`)

## 3. İş Mantığı ve Saat Dilimi Filtrelemesi (`GET`)

1. **Şifre Kapısı ve Oturum Kontrolü:** `rejectIfPasswordChangeRequired(session)` ile geçici şifre oturumları (`403 PASSWORD_CHANGE_REQUIRED`) ve oturumsuz istekler (`401`) engellenir.
2. **Yaşam Döngüsü Ön Temizliği:** `await runReservationLifecycleChecks()` çalıştırılarak süresi dolmuş davetler, Kiosk yoklama süresi geçmiş randevular ve bitiş saati dolmuş (`COMPLETED`) oturumlar veritabanında güncellenir.
3. **Aktif Randevu Sorgusu ve Türkiye Saati Filtresi:**
   - Kullanıcının organizatör (`userId`) veya onaylı katılımcı (`status: "ACCEPTED"`) olduğu, tarihi `>= todayDateObj` ve durumu `["PENDING", "CONFIRMED", "CHECKED_IN"]` olan randevular oda ve katılımcı detaylarıyla çekilir.
   - `Europe/Istanbul` saat dilimine göre gelecek günlere ait (`resDateStr > todayTrStr`) veya bugüne ait olup bitiş dakikası henüz geçmemiş (`endTotalMins > nowTotalMins`, `23:59` gece yarısı bitişleri `1440` dk olarak hesaplanarak) randevular filtrelenip sıralı döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`
- `backend/src/lib/passwordGate.js`
- `backend/src/lib/timeUtils.js`
- `backend/src/lib/lifecycle.js`
