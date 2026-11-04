# Context: rooms/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/rooms/route.js`, kütüphane çalışma odalarının listelendiği, öğrencilerin oda aradığı ve seçilen güne göre odaların dolu zaman dilimlerinin (`occupiedSlots`) çekildiği temel oda keşif uç noktasıdır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Şifre & Sözleşme Kapısı:** `@/middleware/checkRulesAcceptance` (`rejectIfPasswordChangeRequired` ve aktif sözleşme doğrulaması)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `Room`, `Reservation`)
- **Yaşam Döngüsü, Politika & Zaman:** `@/lib/lifecycle` (`runReservationLifecycleChecks`), `@/lib/reservationPolicy` (`getActiveReservationRules`), `@/lib/timeUtils` (`getIstanbulTimeDetails`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (`GET`)

### A. Erişim Kapısı ve Yaşam Döngüsü Ön Temizliği
1. `checkRulesAcceptance(request)` çağrılarak geçici şifre oturumları (`403 PASSWORD_CHANGE_REQUIRED`), oturumsuz istekler (`401`) ve güncel sözleşmeyi onaylamamış kullanıcılar (`403`) engellenir.
2. `await runReservationLifecycleChecks()` çalıştırılarak süresi bitmiş veya davet süresi dolmuş randevular takvimden temizlenir.

### B. Günlük Doluluk Dilimleri (`occupiedSlots`) Hesaplaması
1. İsteğe eklenen `?date=YYYY-MM-DD` parametresi (yoksa Türkiye saatiyle bugünün tarihi) doğrulanır.
2. O güne ait durumu `PENDING`, `CONFIRMED` veya `CHECKED_IN` olan tüm rezervasyonlar, aktif odalar ve `getActiveReservationRules()` paralel (`Promise.all`) çekilir.
3. Her oda nesnesine `occupiedSlots` dizisi ve `maxAdvanceDays` kuralı eklenerek istemciye döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx`
- `backend/src/middleware/checkRulesAcceptance.js`
- `backend/src/lib/lifecycle.js`, `backend/src/lib/reservationPolicy.js`, `backend/src/lib/timeUtils.js`
