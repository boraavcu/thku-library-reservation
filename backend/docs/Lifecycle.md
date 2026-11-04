# Context: lifecycle.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/lifecycle.js`, **THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi**'nin arka plan otomasyon motoru, zamanlayıcısı (scheduler), randevu durum makinesi (state machine) ve adil disiplin/ceza tetikleyicisidir. Hem her 30 saniyede bir çalışan zamanlayıcıyla (`setInterval`) hem de kritik API uç noktalarından tetiklenen `runReservationLifecycleChecks()` fonksiyonuyla rezervasyonların yaşam döngüsünü tamamen PostgreSQL tabanlı atomik sorgularla 7/24 otonom olarak yönetir.

SOLID mimari ilkeleri doğrultusunda e-posta gönderimleri `@/lib/emailService`, ceza/ban kayıtları `@/lib/penaltyService`, kural ve kota yönetimi `@/lib/reservationPolicy`, Kiosk yoklama/kilit sorguları `@/lib/kioskStore`, zaman hesaplamaları ise `@/lib/timeUtils` modülüne ayrılmıştır.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM & Atomik SQL:** `@/lib/db` (Prisma Client) & `@/lib/kioskStore` (`listAttendanceUserIds`, `buildPenaltyTargets`, `claimNoShowCancellation`, `claimPenaltyApplied`, `createPrismaDb`)
- **Yardımcı Servis Modülleri:**
  - `@/lib/timeUtils` (`getIstanbulTimeDetails`, `getReservationKioskWindow`, `parseReservationMinutesUTC`, `fmtTimeUTC`, `fmtDateUTC`, `escapeHtml`)
  - `@/lib/reservationPolicy` (`getActiveReservationRules`, `cancelOrRemoveBannedUserReservations`)
  - `@/lib/penaltyService` (`persistNoShowForUser`, `applyNoShowPenaltiesForUsers`)
  - `@/lib/emailService` (`buildCorporateEmailHtml`, `queueSafeEmail`, `ALLOWED_DIRECTOR_EMAIL` vb.)
- **Eşzamanlılık Koruması:** Tek uçuşlu söz (`globalThis.__thkuLifecyclePromise`) ve PostgreSQL koşullu satır güncelleme kilitleri (`claimNoShowCancellation`, `claimPenaltyApplied`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (`executeLifecycleSweep` & `runReservationLifecycleChecks`)

### A. 30 Dakikalık Davet Süre Aşımı ve Süresi Geçen `PENDING` Randevuların İptali
- Oluşturulmasının üzerinden 30 dakika geçen (`INVITATION_TIMEOUT_MS`) **veya** bitiş saati dolmuş olan (`nowEpochMins >= endEpochMins`) `PENDING` randevuları `updateMany({ where: { id, status: "PENDING" } })` ile atomik olarak `CANCELLED` yapar, `AuditLog` (`AUTO_TIMEOUT_CANCELLED`) yazar ve organizatöre e-posta gönderir.

### B. Son 2 Saat Hatırlatma Bildirimi (`RESERVATION_REMINDER`)
- Bugün ve geçmiş günlerdeki tüm `CONFIRMED` ve `CHECKED_IN` randevuları tarar. Başlangıcına `0 < diffMins <= 120` dakika kalan `CONFIRMED` randevularda tüm onaylı üyelere (daha önce gönderilmediyse) son 2 saat hatırlatma bildirimi ve kurumsal e-postası kuyruğa alır.

### C. PostgreSQL `kiosk_attendances` Üzerinden Adil No-Show, Görevli Onayı Koruması ve Oto-Ban
Kiosk onay penceresi (`nowEpochMins > deadlineEpochMins`) dolmuş ve henüz `penaltyApplied` işlenmemiş randevularda `listAttendanceUserIds` ile PostgreSQL `kiosk_attendances` tablosundan yoklama veren kullanıcı kimlikleri çekilir ve `buildPenaltyTargets` çalıştırılır:
1. **Görevli `FORCE_CHECKIN` Koruması:**
   - Görevli tarafından manuel giriş (`FORCE_CHECKIN`) yapılan randevularda hem durum `CHECKED_IN` olur hem de tüm grup üyeleri `kiosk_attendances` tablosuna yazılır; ayrıca `claimNoShowCancellation` SQL sorgusu `status <> 'CHECKED_IN'` koşulunu zorunlu tuttuğu için görevlinin açtığı oda kesinlikle `NO_SHOW` iptaline düşmez.
2. **Senaryo 1 — Minimum Katılımcı Sağlanmadı (`action === "cancel_no_show"`):**
   - Tek bir `prisma.$transaction` içinde `claimNoShowCancellation` ile randevu atomik olarak `NO_SHOW` (`penaltyApplied: true`) yapılır ve oda boşa çıkarılır (`AUTO_KIOSK_CANCELLED`).
   - Kapıda QR okutmuş olan üyelere (`verifiedUsers`) **ceza yazılmaz**, *"Ceza Uygulanmadı"* bildirimi/e-postası hazırlanır.
   - Gelmeyen üyelere (`absentUsers`) aynı transaction içinde `persistNoShowForUser` ile `+15` puan ve `NO_SHOW` uyarısı işlenir; `3/3` sınırına ulaşanlar 30 gün banlanır, gelecekteki randevuları `cancelOrRemoveBannedUserReservations` ile düşürülür ve Kütüphane Müdürüne detaylı yoklama raporu gönderilir.
3. **Senaryo 2 — Oda Açıldı Ancak Eksik Üye Var (`action === "penalize_absent"`):**
   - Oda iptal edilmez; `claimPenaltyApplied` kilidi alınarak yalnızca kapıda QR okutmayan `absentUsers` üyelerine bireysel `NO_SHOW` uyarısı (ve `3/3` ise 30 gün ban) uygulanır.

### D. Süresi Biten Randevuların Otomatik Tamamlanması (`CONFIRMED` / `CHECKED_IN` -> `COMPLETED`)
- Bitiş dakikası geçmiş (`nowEpochMins >= endEpochMins`) olan hem `CONFIRMED` hem de `CHECKED_IN` durumundaki tüm randevular (`penaltyApplied` değerinden bağımsız olarak) otomatik biçimde **`COMPLETED`** statüsüne geçirilir. Böylece yönetim panelindeki canlı doluluk metrikleri ve öğrenci aktif randevu listeleri her zaman doğru kalır.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/kioskStore.js`
- `backend/src/lib/penaltyService.js`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/lib/emailService.js`
- `backend/src/lib/timeUtils.js`
- `backend/src/app/api/kiosk/qr/route.js` & `checkin/validate/route.js`
- `backend/src/app/api/reservations/route.js` & `active/route.js`
- `backend/src/app/api/invitations/route.js` & `respond/route.js`
- `backend/src/app/api/rooms/route.js` & `rooms/[id]/availability/route.js`
- `backend/src/app/api/dashboard/room-density/route.js`
- `backend/src/app/api/admin/manage/route.js`
