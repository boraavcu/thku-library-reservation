# Context: rooms/[id]/availability/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/rooms/[id]/availability/route.js`, öğrencinin `ReserveForm.jsx` ekranında seçtiği çalışma odası (`[id]`) ve tarih (`?date=YYYY-MM-DD`) için **dolu olan saat aralıklarını (`occupiedSlots`)** döndüren gerçek zamanlı müsaitlik sorgu uç noktasıdır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `Reservation`)
- **Yaşam Döngüsü Motoru:** `@/lib/lifecycle` (`runReservationLifecycleChecks`)

## 3. İş Mantığı ve Boşa Düşen Odaların Anında Açılması (`GET`)

1. **Şifre Kapısı ve Oturum Kontrolü:** `rejectIfPasswordChangeRequired(session)` ile geçici şifre oturumları (`403`) ve oturumsuz istekler (`401`) reddedilir.
2. **Otomatik Ön Temizlik (`runReservationLifecycleChecks`):**
   - Takvim verisi çekilmeden hemen önce `await runReservationLifecycleChecks()` çalıştırılır; böylece 30 dakikalık davet süresi dolan veya Kiosk yoklama süresi geçen randevular anında düşürülür.
3. **Yalnızca Aktif Randevuların Filtrelenmesi:**
   - Sorguda yalnızca `status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }` durumundaki randevular çekilir.
   - `CANCELLED`, `NO_SHOW` ve `COMPLETED` (erken boşaltılan veya süresi tamamlanan) randevular dahil edilmediği için boşa çıkan saat dilimleri saniyesinde diğer öğrencilerin seçimine açılır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/ReserveForm.jsx`
- `backend/src/lib/passwordGate.js`
- `backend/src/lib/lifecycle.js`
