## 3. `backend/docs/PenaltyService.md`

```markdown
# Context: penaltyService.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/penaltyService.js`, hem otonom yaşam döngüsü motoru (`lifecycle.js`) hem de Yönetim Panelindeki görevli/müdür müdahalesi (`MARK_NO_SHOW`) tarafından ortak kullanılan **Adil No-Show Ceza ve 3/3 Otomatik 30 Gün Ban** servisidir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `PenaltyHistory`, `User`, `Reservation`, `AuditLog`)
- **E-Posta Servisi:** `@/lib/emailService` (`sendNoShowWarningEmail`)
- **Zaman Modülü:** `@/lib/timeUtils` (`getIstanbulTimeDetails`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (`applyNoShowPenaltiesForUsers`)

Kapı QR kodunu süresi içinde okutmayan (`usersToPenalize`) her grup üyesi için sırasıyla şu adımları yürütür:
1. **Ceza Tarihçesi Kaydı (`PenaltyHistory`):**
   - `penaltyType: "NO_SHOW"`, `penaltyPoints: 15`, `isActive: true` olarak yeni uyarı kaydı oluşturur.
2. **Aktif Uyarı Sayımı ve 3/3 Ban Kuralı:**
   - Öğrencinin aktif `NO_SHOW` uyarı sayısını (`activeNoShowCount`) sayar.
   - `activeNoShowCount >= 3` ise (`shouldBan = true`), öğrenciyi **30 gün süreyle** banlar (`isBanned: true`, `banUntil: now + 30 gün`) ve toplam ceza puanını `15` artırır.
3. **Denetim İzleri ve Bildirim E-Postası:**
   - `writeAuditLog === true` ise `AuditLog` tablosuna `AUTO_NO_SHOW_PENALTY` veya `AUTO_NO_SHOW_BANNED` kaydı düşer.
   - `sendNoShowWarningEmail` ile öğrenciye kaçıncı uyarısını aldığını (`1/3`, `2/3` veya `3/3 Ban`) bildiren kurumsal HTML e-posta ve uygulama içi bildirim gönderir.
4. **Banlanan Öğrencinin Bugünkü ve Gelecekteki Randevularının İptali:**
   - Öğrenci 3/3 uyarıyla banlandığında, `reservationDate: { gte: todayDate }` filtresiyle bugünün ilerleyen saatlerindeki ve gelecekteki tüm `PENDING` / `CONFIRMED` randevuları otomatik olarak `CANCELLED` yapılır.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/lifecycle.js`
- `backend/src/app/api/admin/manage/handlers.js`
- `backend/src/lib/emailService.js`
```
