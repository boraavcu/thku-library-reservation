# Context: invitations/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/invitations/route.js`, öğrenciye gönderilen ve yanıt bekleyen (`PENDING`) grup çalışması davetlerini `Dashboard.jsx`, `MyBookings.jsx` ve `Navbar.jsx` bildirim merkezine ileten uç noktadır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`, `ReservationParticipant`)
- **Zaman & Yaşam Döngüsü:** `@/lib/timeUtils` (`getIstanbulTimeDetails`, `parseReservationMinutesUTC`) & `@/lib/lifecycle` (`runReservationLifecycleChecks`)

## 3. İş Mantığı ve Geçerlilik Filtresi (`GET`)

1. **Şifre Kapısı ve Oturum Kontrolü:** `rejectIfPasswordChangeRequired(session)` ile geçici şifre oturumları (`403 PASSWORD_CHANGE_REQUIRED`) ve oturumsuz istekler (`401`) reddedilir.
2. **Yaşam Döngüsü Temizliği:** `await runReservationLifecycleChecks()` çalıştırılarak 30 dakikalık onay süresi dolmuş davetler veritabanında düşürülür.
3. **Aktif Davet Sorgusu ve Türkiye Saati Filtresi:**
   - `prisma.reservationParticipant.findMany` ile kullanıcıya ait `status: "PENDING"` olan ve bağlı olduğu rezervasyonu `["PENDING", "CONFIRMED"]` durumunda bulunan davetler çekilir.
   - `Europe/Istanbul` saat dilimine göre randevunun bitiş saati henüz geçmemiş olanlar (`endTotalMins > nowTotalMins`) filtrelenerek oda ve organizatör bilgileriyle birlikte döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`, `MyBookings.jsx` ve `components/Navbar.jsx`
- `backend/src/app/api/invitations/respond/route.js`
- `backend/src/lib/passwordGate.js`
- `backend/src/lib/timeUtils.js` & `backend/src/lib/lifecycle.js`
