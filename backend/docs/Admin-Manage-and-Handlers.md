# Context: admin/manage/route.js & handlers.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/admin/manage/route.js` ve `handlers.js`, Yönetim Panelinin (`AdminPanel.jsx`) tüm analitik veri sorgulama (`GET`) ve idari operasyon (`POST`) uç noktasıdır.

**SOLID & Açık/Kapalı Prensibi (OCP):** `route.js` oturum, zorunlu şifre değişimi kapısı (`rejectIfPasswordChangeRequired`), rol yetkisi (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`), 180/365 günlük log arşiv politikası ve analitik hesaplamaları (`GET`) yürütür; `POST` isteklerini ise `handlers.js` içindeki `ADMIN_ACTION_HANDLERS` komut haritasına devreder.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`, `noStoreJson`)
- **Veritabanı & Atomik Yoklama:** `@/lib/db` (Prisma Client — `kioskAttendances` ilişkisi) & `@/lib/kioskStore` (`buildPenaltyTargets`, `claimNoShowCancellation`, `claimPenaltyApplied`, `createPrismaDb`, `listAttendanceUserIds`)
- **Personel & Test Verisi Servisleri:** `@/lib/staffAccount` (`createStaffAccount`, `resetStaffTempPassword`, `setStaffActive`), `@/lib/staffAuth.mjs` (`toAdminUser`), `@/lib/testData` (`purgeDemoTestData`)
- **Yardımcı Servisler:** `@/lib/lifecycle`, `@/lib/timeUtils`, `@/lib/emailService`, `@/lib/penaltyService`, `@/lib/reservationPolicy`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. `GET /api/admin/manage` — Analitik, PostgreSQL Yoklama İlişkisi ve 180/365 Gün Log Motoru
1. **Şifre Kapısı ve Rol Kontrolü:** `rejectIfPasswordChangeRequired(session)` kontrolünden sonra yalnızca `LIBRARIAN`, `ADMIN` ve `SUPER_ADMIN` rollerine izin verilir; denetim loglarını (`auditLogs`, `adminActions`) yalnızca `ADMIN` ve `SUPER_ADMIN` görüntüleyebilir (`canViewLogs`).
2. **365 Gün Otomatik Arşiv Temizliği:** 365 günü aşan `AuditLog` ve `AdminAction` kayıtlarını otomatik siler; son 180 günü aktif listeler, 180–365 gün arasını `archivedRecordsCount` olarak raporlar.
3. **Tek Sorguda Kiosk Yoklama ve Güvenli Kullanıcı Projeksiyonu:**
   - Son 250 rezervasyon çekilirken Prisma `kioskAttendances: { select: { userId: true } }` ilişkisi doğrudan dahil edilerek `checkedInUsers` ve `checkedInCount` alanları N+1 sorgu olmadan üretilir.
   - Kullanıcı listesi `toAdminUser` üzerinden geçirilerek `passwordHash` gizlenir, yalnızca `isActive` ve `passwordLogin` (`Boolean`) bayrakları döndürülür.
4. **Gerçek Zamanlı Analitik Üretimi (`analytics`):** `hourlyHeatmap`, `peakHour`, `departmentBreakdown`, `roomBreakdown`, `activeNowRooms`, `upcomingHourReservations`, `upcomingHourStudents`, `completionRate`, `cancellationRate`, `noShowRate`, `avgDurationHours` ve `avgGroupSize` metriklerini hesaplar.

### B. `POST /api/admin/manage` — `ADMIN_ACTION_HANDLERS` Komutları (`handlers.js`)
| Aksiyon (`action`) | Yetki | Açıklama |
| :--- | :--- | :--- |
| `CREATE_STAFF_ACCOUNT` | `SUPER_ADMIN` | Tam `@thk.edu.tr` uzantılı personel hesabı açar, 24 saatlik tek gösterimlik geçici şifreyi `noStoreJson` ile döndürür ve SMTP bildirimi tetikler. |
| `RESET_STAFF_TEMP_PASSWORD` | `SUPER_ADMIN` | Personel için yeni geçici şifre üretir, `mustChangePassword: true` yapar ve `sessionVersion` artışıyla açık oturumlarını düşürür. |
| `SET_STAFF_ACTIVE` | `SUPER_ADMIN`, `ADMIN` | Yetkili hesabı aktif/pasif yapar (`ADMIN` yalnızca `LIBRARIAN` üzerinde yetkilidir) ve `sessionVersion` artışıyla pasif hesabın oturumunu anında kapatır. |
| `PURGE_TEST_DATA` | `SUPER_ADMIN` | `purgeDemoTestData` ile tüm `@demo.local` test kullanıcılarını ve test rezervasyonlarını kurumsal verilere dokunmadan transaction içinde siler. |
| `TOGGLE_ROOM` | Tüm Yetkililer | Odayı yeni randevulara açar/kapatır (mevcut onaylı randevular korunur). |
| `CREATE_ROOM` / `UPDATE_ROOM` / `DELETE_ROOM` | `ADMIN`, `SUPER_ADMIN` | Oda ekleme, güncelleme ve ilişkili kayıtlarıyla birlikte transaction içinde silme işlemlerini yürütür. |
| `RESERVATION_OP` | Tüm Yetkililer | **`FORCE_CHECKIN`:** Rezervasyon satırını `FOR UPDATE` ile kilitler, tüm onaylı üyeleri PostgreSQL `kioskAttendance.upsert` ile yoklamaya işler ve durumu `CHECKED_IN` (`checkedInById: adminId`) yapar.<br>**`EARLY_FINISH`:** Randevuyu `COMPLETED` yapar ve kalan saat dilimini boşa çıkarır (ileri tarihli randevuda `endTime = startTime`, bugünkü aktif randevuda `endTime = şu anki saat`; `reservations/route.js` `ACTIVE_ROOM_STATUSES` sayede odayı hemen yeni rezervasyonlara açar).<br>**`CANCEL`:** Görevli iptali yapar ve gruba e-posta gönderir.<br>**`MARK_NO_SHOW`:** `FOR UPDATE` kilidi, `listAttendanceUserIds` ve `buildPenaltyTargets` ile yalnızca QR okutmayan üyelere `persistNoShowForUser` üzerinden ceza/ban uygular. |
| `CREATE_ANNOUNCEMENT` / `DELETE_ANNOUNCEMENT` | Tüm Yetkililer | TR/EN çok dilli duyuru yayınlar veya siler. |
| `USER_MODERATION` | `ADMIN`, `SUPER_ADMIN` | `BAN_USER`, `UNBAN`, `RESET_PENALTY` ve hiyerarşi korumalı `CHANGE_ROLE` işlemlerini uygular. |
| `UPDATE_RULE` | `ADMIN`, `SUPER_ADMIN` | 7 dinamik rezervasyon kuralını (`ReservationRule`) günceller. |

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/AdminPanel.jsx` & `frontend/src/components/admin/*`
- `backend/src/lib/staffAccount.js` & `backend/src/lib/testData.js`
- `backend/src/lib/kioskStore.js` & `backend/src/lib/passwordGate.js`
- `backend/src/lib/penaltyService.js`, `backend/src/lib/reservationPolicy.js`, `backend/src/lib/emailService.js`
