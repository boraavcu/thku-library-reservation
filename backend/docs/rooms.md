## 1. Dosyanın Amacı ve Mimari Rolü

`rooms/route.js`, kütüphane çalışma odalarının listelendiği, öğrencilerin oda aradığı ve seçilen güne göre odaların dolu zaman dilimlerinin (`occupiedSlots`) çekildiği temel oda keşif uç noktasıdır.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `Room`, `Reservation`, `SystemAgreement`)
- **Güvenlik & Kural Kontrolü:** `@/middleware/checkRulesAcceptance`
- **Yaşam Döngüsü Tetikleyicisi:** `@/lib/lifecycle` (`runReservationLifecycleChecks`)
- **Zaman Modülü:** `@/lib/timeUtils` (`getIstanbulTimeDetails`, `timeStrToFakeUtc`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Yaşam Döngüsü ve İsim Normalizasyonu
- Her oda sorgusunda arka planda `runReservationLifecycleChecks()` asenkron tetiklenerek süresi bitmiş veya onaylanmamış randevular takvimden temizlenir.
- Eski veritabanı tohumlarından kalan R103 `"Uçantürk"` oda ismi tespit edilirse otomatik olarak `"Hürkuş"` olarak düzeltilir.

### B. Günlük Doluluk Dilimleri (`occupiedSlots`) Hesaplaması
Frontend'deki `StudyRooms.jsx` filtrelerinin (Süre ve Saat Aralığı) gerçek zamanlı çalışabilmesi için:
1. İsteğe eklenen `?date=YYYY-MM-DD` parametresi doğrulanır.
2. O güne ait durumu `PENDING`, `CONFIRMED` veya `CHECKED_IN` olan tüm rezervasyonlar çekilir.
3. Her oda nesnesine `occupiedSlots: [{ start: "09:00", end: "11:00", status: "CONFIRMED" }]` dizisi eklenir.
4. Aktif sözleşmeden `maxAdvanceDays` (Kaç gün sonrasına kadar seçilebilir) kuralı çekilerek yanıta dahil edilir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx`
- `backend/src/lib/lifecycle.js`
- `backend/src/middleware/checkRulesAcceptance.js`