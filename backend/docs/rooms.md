# Context: rooms/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/rooms/route.js`, kütüphane çalışma odalarının listelendiği, öğrencilerin oda aradığı ve seçilen güne göre odaların dolu zaman dilimlerinin (`occupiedSlots`) çekildiği temel oda keşif uç noktasıdır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `Room`, `Reservation`)
- **Yaşam Döngüsü Tetikleyicisi:** `@/lib/lifecycle` (`runReservationLifecycleChecks`)
- **Rezervasyon Politikası:** `@/lib/reservationPolicy` (`getActiveReservationRules`)
- **Zaman Modülü:** `@/lib/timeUtils` (`getIstanbulTimeDetails`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Yaşam Döngüsü Ön Temizliği
- Her oda sorgusunda arka planda `runReservationLifecycleChecks()` asenkron tetiklenerek süresi bitmiş veya onaylanmamış randevular takvimden temizlenir.

### B. Günlük Doluluk Dilimleri (`occupiedSlots`) Hesaplaması
Frontend'deki `StudyRooms.jsx` filtrelerinin (Süre ve Saat Aralığı) gerçek zamanlı çalışabilmesi için:
1. İsteğe eklenen `?date=YYYY-MM-DD` parametresi (yoksa Türkiye saatiyle bugünün tarihi) doğrulanır.
2. O güne ait durumu `PENDING`, `CONFIRMED` veya `CHECKED_IN` olan tüm rezervasyonlar ile `getActiveReservationRules()` paralel (`Promise.all`) çekilir.
3. Her oda nesnesine `occupiedSlots` dizisi ve `maxAdvanceDays` kuralı eklenerek istemciye döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx`
- `backend/src/lib/lifecycle.js`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/lib/timeUtils.js`
