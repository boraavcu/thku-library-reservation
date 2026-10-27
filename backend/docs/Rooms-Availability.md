# Context: rooms/[id]/availability/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/rooms/[id]/availability/route.js`, öğrencinin `ReserveForm.jsx` ekranında seçtiği çalışma odası (`[id]`) ve tarih (`?date=YYYY-MM-DD`) için **dolu olan saat aralıklarını (`occupiedSlots`)** döndüren gerçek zamanlı müsaitlik sorgu uç noktasıdır (`GET`).

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client)
- **Yaşam Döngüsü Motoru:** `@/lib/lifecycle` (`runReservationLifecycleChecks`)

##  3. İş Mantığı ve Boşa Düşen Odaların Anında Açılması

1. **Otomatik Ön Temizlik (`runReservationLifecycleChecks`):**
   - Takvim verisi çekilmeden hemen önce `await runReservationLifecycleChecks()` çalıştırılır.
   - Böylece 30 dakikalık davet onay süresi dolan (`PENDING -> CANCELLED`) veya ±15 dakikalık Kiosk kapı QR yoklama süresi geçtiği için iptal edilen (`CONFIRMED -> NO_SHOW`) randevular veritabanında anında düşürülür ve takvimde boş görünür.
2. **Yalnızca Aktif Randevuların Filtrelenmesi (`status` Kuralı):**
   - Sorguda yalnızca `status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }` durumundaki randevular çekilir.
   - **Kritik Mimari Karar:** `CANCELLED` (iptal edilen), `NO_SHOW` (gelinmeyen) ve `COMPLETED` (öğrenciler veya görevli tarafından **Odayı Erken Boşalt** yapılan) randevular sorguya dahil edilmez (veya erken boşaltmada `endTime` o anki saate çekilir). Bu sayede boşa çıkan saat dilimleri saniyesinde diğer öğrencilerin seçimine açılır.
3. **UTC Saat Formatlama (`occupiedSlots`):**
   - Her dolu randevunun `startTime` ve `endTime` değerleri `HH:mm` formatına (`10:00`, `13:00` vb.; gece yarısı `23:59` bitişleri `ReserveForm.jsx` tarafından `24:00` olarak yorumlanacak şekilde) dönüştürülerek istemciye döndürülür.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/ReserveForm.jsx`
- `backend/src/lib/lifecycle.js`