# Context: testData.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/testData.js`, canlıya geçiş öncesinde veya sistem testleri tamamlandığında Bilgi İşlem Sistem Yöneticisinin (`SUPER_ADMIN`) Yönetim Paneli üzerinden tek tıkla tüm `@demo.local` uzantılı test hesaplarını ve bu hesapların ürettiği test verilerini **gerçek kurumsal hesaplara, çalışma odalarına, sözleşmelere ve sistem kurallarına zarar vermeden** güvenli bir veritabanı transaction'ı içinde temizlemesini sağlayan servistir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `$transaction`, `User`, `Reservation`, `PenaltyHistory`, `ReservationParticipant`, `AdminAction`, `AuditLog`, `EmailQueue`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (`purgeDemoTestData(adminId)`)

1. **Hedef Test Hesaplarının Tespiti:**
   - E-posta adresi `@demo.local` ile biten ve işlemi tetikleyen mevcut yönetici (`NOT: { id: adminId }`) dışındaki tüm kullanıcıları bulur. Silinecek kayıt yoksa `{ ok: true, status: 200, deletedUsers: 0, deletedReservations: 0 }` döndürür.
2. **Yabancı Anahtar (FK) Bütünlüklü Atomik Temizlik (`prisma.$transaction`):**
   - Demo kullanıcıların organizatör olduğu rezervasyonlara bağlı `PenaltyHistory` kayıtlarını ve ilgili `Reservation` satırlarını siler (`KioskAttendance`, `KioskDeviceLock`, `KioskCheckInCode` ve `ReservationParticipant` kayıtları `onDelete: Cascade` ile otomatik temizlenir).
   - Demo kullanıcıların başka randevulardaki `ReservationParticipant` katılımlarını siler ve `checkedInById` referanslarını `null` yapar.
   - Demo yöneticilerin yaptığı `AdminAction` kayıtlarını siler; kurumsal yöneticilerin demo kullanıcılar üzerinde yaptığı işlemlerdeki `affectedUserId` ile `AuditLog.userId` referanslarını denetim izini bozmamak için `null` değerine çeker.
   - `@demo.local` alıcılı `EmailQueue` kayıtlarını ve son olarak demo `User` kayıtlarını siler.
3. **İdari Denetim Kaydı:**
   - Aynı transaction içinde `AdminAction` tablosuna silinen kullanıcı ve rezervasyon sayısını içeren `BULK_OPERATION` logu düşer.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/admin/manage/handlers.js` (`PURGE_TEST_DATA` aksiyonu)
- `frontend/src/pages/AdminPanel.jsx`
