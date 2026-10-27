# Context: dashboard/room-density/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/dashboard/room-density/route.js`, Yönetim Panelindeki (`AdminPanel.jsx`) `RoomDensityChart.jsx` bileşenini besleyen ve her çalışma odasının bugünkü **24 saatlik dilim üzerinden doluluk yüzdesini (`occupancyPercent`)** hesaplayan analitik uç noktadır (`GET`).

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Kimlik Doğrulama:** `next-auth` (`getServerSession`, `authOptions`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client)

##  3. İş Mantığı ve 7/24 Doluluk Hesaplaması

1. **Türkiye Saat Dilimi (`Europe/Istanbul`) Bazlı Tarih Seçimi:**
   - Sunucu hangi saat diliminde çalışırsa çalışsın `now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })` ile Türkiye'deki bugünün tarihi (`YYYY-MM-DD`) baz alınır.
2. **Saat Kesişimi ve Gece Yarısı Normalizasyonu (`TOTAL_HOURS = 24`):**
   - Kütüphane 7/24 hizmet verdiği için `LIBRARY_OPEN = 0` ve `LIBRARY_CLOSE = 24` (`TOTAL_HOURS = 24`) olarak sabitlenmiştir.
   - Her odanın bugünkü `PENDING`, `CONFIRMED`, `CHECKED_IN` ve `COMPLETED` randevuları taranır.
   - `23:59` olarak kaydedilmiş gece yarısı bitişleri tam `24.0` saat olarak yuvarlanır ve odanın bugün toplam kaç saat rezerve edildiği (`bookedHours`) hesaplanır.
3. **Yüzde ve Ortalama Üretimi:**
   - Her oda için `occupancyPercent = Math.round((bookedHours / 24) * 100)` değeri ve tüm odaların genel ortalaması (`averageOccupancy`) döndürülür.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/components/dashboard/RoomDensityChart.jsx`
- `frontend/src/pages/AdminPanel.jsx`