# Context: dashboard/room-density/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/dashboard/room-density/route.js`, öğrenci ve yönetim panellerindeki `RoomDensityChart.jsx` bileşenini besleyen ve her çalışma odasının bugünkü **24 saatlik dilim üzerinden doluluk yüzdesini (`occupancyPercent`)** hesaplayan analitik uç noktadır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `Room`, `Reservation`)
- **Yaşam Döngüsü Motoru:** `@/lib/lifecycle` (`runReservationLifecycleChecks`)

## 3. İş Mantığı ve 7/24 Doluluk Hesaplaması (`GET`)

1. **Şifre Kapısı, Oturum ve Ön Temizlik:** `rejectIfPasswordChangeRequired(session)` ve oturum kontrolünün ardından `await runReservationLifecycleChecks()` çalıştırılır.
2. **Türkiye Saat Dilimi (`Europe/Istanbul`) Bazlı Tarih Seçimi:** Sunucu saat diliminden bağımsız olarak Türkiye'deki bugünün tarihi (`todayDate`) hesaplanır.
3. **Saat Kesişimi ve Gece Yarısı Normalizasyonu (`TOTAL_HOURS = 24`):**
   - Kütüphane 7/24 hizmet verdiği için `LIBRARY_OPEN = 0` ve `LIBRARY_CLOSE = 24` (`TOTAL_HOURS = 24`) olarak sabitlenmiştir.
   - Bugünkü `PENDING`, `CONFIRMED`, `CHECKED_IN` ve `COMPLETED` randevular taranır; `23:59` gece yarısı bitişleri `24` olarak normalize edilir ve her oda için `bookedHours`, `occupancyPercent` ve genel `averageOccupancy` döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/components/dashboard/RoomDensityChart.jsx`
- `backend/src/lib/passwordGate.js`
- `backend/src/lib/lifecycle.js`
