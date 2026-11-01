## 1. Dosyanın Amacı ve Mimari Rolü

`penaltyService.js`, kütüphane kullanım kurallarını ihlal eden (No-Show, geç kalma, kurallara uymama) öğrencilerin disiplin kayıtlarını tutan, **dönemlik 3/3 ceza limitini** denetleyen ve kuralı aşan öğrencileri otomatik olarak **30 gün süreyle sistemden askıya alan (banlayan)** bağımsız disiplin servisidir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `PenaltyLog`, `User`, `Reservation`, `AuditLog`)
- **Zaman Modülü:** `@/lib/timeUtils` (`getIstanbulTimeDetails`)
- **E-Posta Servisi:** `@/lib/emailService` (`sendNoShowWarningEmail`, `sendBanEmail`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. No-Show Cezası Uygulama (`applyNoShowPenalty`)
Yoklamaya katılmayan (`absentUsers`) öğrencilere uygulanır:
1. `PenaltyLog` tablosuna `NO_SHOW` tipinde, oda ve rezervasyon referansıyla yeni bir ceza kaydı yazılır.
2. Öğrencinin aktif dönemdeki toplam ceza sayısı (`penaltyCount`) sayılır.
3. Eğer `penaltyCount >= 3` ise `banUserAccount` fonksiyonu devreye girer.
4. Öğrenciye ceza uyarı maili gönderilir (`1/3` veya `2/3`).

### B. Otomatik 30 Gün Hesap Askıya Alma (`banUserAccount`)
1. Kullanıcı kaydı güncellenir:
   - `isBanned = true`
   - `bannedUntil = now + 30 gün`
2. **Aynı Gün ve İleri Tarihli Randevuların İptali:**
   - PostgreSQL `@db.Date` alanının saat dilimi yapısı gözetilerek `reservationDate: { gte: todayDate }` filtresiyle, kullanıcının bugünkü ileri saatli randevuları dahil tüm gelecek rezervasyonları `CANCELLED` yapılır ve odalar boşa çıkarılır.
3. Kütüphane Müdürüne ve öğrenciye ban bilgilendirme e-postası iletilir.

### C. Yönetici Tarafından Manuel Ceza ve Ban İşlemleri (`manualBanUser` & `manualUnbanUser`)
- Admin panelden yapılan müdahalelerde işlem `AuditLog` tablosuna yönetici ID'si ile mühürlenir.
- Ban kaldırıldığında (`manualUnbanUser`) `isBanned: false` yapılır ve öğrencinin rezervasyon yapma hakkı anında iade edilir.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/lifecycle.js`
- `backend/src/app/api/admin/manage/handlers.js`
- `backend/src/app/api/profile/route.js`
- `backend/src/lib/emailService.js`