# Context: lifecycle.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/lifecycle.js`, **THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi**'nin arka plan otomasyon motoru, zamanlayıcısı (scheduler), randevu durum makinesi (state machine) ve adil disiplin/ceza tetikleyicisidir. Hem her 30 saniyede bir çalışan zamanlayıcıyla hem de kritik API uç noktalarından tetiklenen `runReservationLifecycleChecks()` fonksiyonuyla rezervasyonların yaşam döngüsünü 7/24 otonom olarak yönetir.

Yapılan son SOLID mimari revizyonu ile e-posta gönderimleri `@/lib/emailService` modülüne, ceza/ban mekanizmaları `@/lib/penaltyService` modülüne, dinamik kural okumaları `@/lib/reservationPolicy` modülüne, zaman hesaplamaları ise `@/lib/timeUtils` modülüne devredilmiş; `lifecycle.js` yalnızca saf bir **orkestratör (Single Responsibility)** haline getirilmiştir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `Reservation`, `Notification`, `AuditLog`)
- **Önbellek & Dağıtık Kilit:** `@/lib/redis` (`ioredis` — `lock:thku_lifecycle` dağıtık kilidi & `kiosk:checked_users:${reservationId}` kümesi)
- **Harici Servis Modülleri:**
  - `@/lib/timeUtils` (`getIstanbulTimeDetails`, `getReservationKioskWindow`, `parseReservationMinutesUTC`, `fmtTimeUTC`, `fmtDateUTC`, `escapeHtml`)
  - `@/lib/reservationPolicy` (`getActiveReservationRules`)
  - `@/lib/penaltyService` (`applyNoShowPenaltiesForUsers`)
  - `@/lib/emailService` (`buildCorporateEmailHtml`, `queueSafeEmail`, `sendNoShowWarningEmail`, `sendKioskCheckInEmailToStaff`, `sendReservationCancelledEmails`)
- **Çalışma Zamanı:** Node.js / Next.js API ortamı (global eşzamanlılık kilidi: `globalThis.__thkuLifecycleRunning` + Redis `lock:thku_lifecycle`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Dinamik Kiosk Yoklama Penceresi Hesaplayıcısı (`getReservationKioskWindow`)
Normal randevular ile boşa düşen odayı sonradan tutan (walk-in) randevuları birbirinden ayıran kritik fonksiyondur (`@/lib/timeUtils` üzerinden çağrılır ve dışa aktarılır):
1. **Normal Randevular (`createdAt <= startTotalMins`):**
   - Randevu başlangıç saatinden önce oluşturulduysa, Kiosk kapı QR onay penceresi kesin olarak **`startTotalMins - toleranceMinutes` ile `startTotalMins + toleranceMinutes`** (örneğin saat `16:00` randevusu için `15:45 – 16:15`) arasındadır.
   - Davet edilen arkadaşın daveti `16:04` veya `16:14`'te kabul etmesi (`updatedAt`) bu pencereyi **asla uzatmaz**; son onay dakikası `16:15` olarak sabit kalır.
2. **Boşa Düşen Odayı Ara Dakikada Tutma (Walk-In, `createdAt > startTotalMins`):**
   - Eğer `16:00` randevusu olan ilk grup gelmediği için `16:16`'da oda `NO_SHOW` olup boşa düştüyse (veya erken boşaltıldıysa) ve saat `16:20`'de gelen yeni bir grup `16:00 – 18:00` dilimini sıfırdan rezerve ettiyse, bu yeni gruba odaya girerken hemen QR okutabilmeleri için **`[createdInfo.totalMins, createdInfo.totalMins + toleranceMinutes]` (`16:20 – 16:35`)** aralığında 15 dakikalık Kiosk onay penceresi tanımlar.

### B. Otomatik Yaşam Döngüsü Denetimleri (`runReservationLifecycleChecks`)
Çakışmaları önlemek için hem `globalThis.__thkuLifecycleRunning` hem de Redis `SET lock:thku_lifecycle 1 NX EX 25` dağıtık kilidiyle çalışan fonksiyon her döngüde şu 4 aşamalı denetimi atomik olarak yapar:
1. **30 Dakikalık Davet Süre Aşımı (`INVITATION_TIMEOUT_MS`):**
   - Oluşturulmasının üzerinden 30 dakika geçtiği halde hâlâ `PENDING` durumunda kalan (yeterli grup onayı almamış) randevuları `updateMany({ where: { id, status: "PENDING" } })` ile atomik olarak `CANCELLED` yapar, `AuditLog` tablosuna `AUTO_TIMEOUT_CANCELLED` kaydı düşer, odayı anında boşa çıkarır ve organizatöre bilgi maili gönderir.
2. **Son 2 Saat Hatırlatma Bildirimi (`RESERVATION_REMINDER`):**
   - Başlangıcına 120 dakika veya daha az kalan `CONFIRMED` randevular için (daha önce gönderilmediyse) tüm grup üyelerine *"Randevunuza Son 2 Saat Kaldı (Son 1 saat içinde iptal yapılamaz)"* bildirimi ve e-postası gönderir.
3. **Kiosk Yoklama Süresi (`deadlineEpochMins`) Dolduğunda Adil No-Show ve Otomatik Ban Denetimi:**
   - **Senaryo 1 (En Az 2 Kişi QR Okutmadı -> Oda İptal & Boşa Çıkarma):**
     - Kapıda QR okutan kişi sayısı `checkedUserIds.length < minRequiredPeople` (varsayılan: 2) ise randevu otomatik olarak **`NO_SHOW`** durumuna çekilir ve oda takvimde anında diğer öğrencilere açılır (`AUTO_KIOSK_CANCELLED`).
     - **Adil Ceza Koruması (`verifiedUsers` vs `absentUsers`):** Grupta kendi üzerine düşeni yapıp kapıda QR okutmuş olan öğrenci varsa (`verifiedUsers`), ona **kesinlikle ceza yazılmaz** ve *"Tarafınıza ceza işlenmemiştir"* bilgi maili gider.
     - Kapıda QR okutmayan üyelere (`absentUsers`) ise `applyNoShowPenaltiesForUsers` aracılığıyla `PenaltyHistory` tablosunda `NO_SHOW` kaydı işlenir. Aktif uyarı sayısı `3/3` olan öğrenci otomatik olarak **30 gün banlanır**, gelecekteki ve aynı günün ilerleyen saatlerindeki aktif randevuları `cancelOrRemoveBannedUserReservations` ile düşürülür ve Kütüphane Müdürüne yoklama özetini içeren otomatik iptal raporu maili gönderilir.
   - **Senaryo 2 (En Az 2 Kişi Okutup Odayı Açtı, Ancak 3./4. Üye Gelmedi):**
     - Oda iptal edilmez (içerideki grup çalışmasına devam eder), ancak kapı QR kodunu okutmayan `absentUsers` üyelerine bireysel `1/3 No-Show` uyarısı (ve `3/3` ise 30 gün ban) otomatik işlenir.
4. **Oturum Tamamlama ve Odayı Boşaltma (`CHECKED_IN -> COMPLETED`):**
   - Kullanım süresi biten (`nowEpochMins >= endEpochMins`) ve durumu hâlâ `CHECKED_IN` olan randevular taranır.
   - Öğrenciler çıkışta erken boşaltma butonuna basmamış olsalar dahi randevu otomatik olarak **`COMPLETED`** durumuna geçirilir. Böylece Admin Panel'deki *"Şu An Dolu Oda"* sayısı şişmez ve `MyBookings` ekranında oturum başarıyla arşivlenir.

### C. Gece Yarısı Sınır Geçiş Desteği (Midnight Boundary Support)
- Kütüphanenin `23:00 – 24:00` dilimindeki randevuları için Kiosk tolerans penceresi ertesi günün ilk dakikalarına (`00:15`) taşar.
- `lifecycle.js`, randevu sorgulamalarında yalnızca bugünü değil, `[yesterdayDateObj, todayDateObj]` kümesini epoch dakikaları (`resDayEpochMins`) üzerinden birlikte tarayarak gece yarısı sınırındaki randevuların sahipsiz kalmasını ve tolerans penceresinin kopmasını engeller.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/penaltyService.js` (Ceza ve ban yürütücüsü)
- `backend/src/lib/reservationPolicy.js` (Dinamik kurallar ve banlı öğrenci randevu düşürme politikası)
- `backend/src/lib/emailService.js` (E-posta bildirim motoru)
- `backend/src/lib/timeUtils.js` (Zaman normalizasyonu)
- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/app/api/invitations/respond/route.js`
- `backend/src/app/api/reservations/route.js` & `active/route.js`
- `backend/src/app/api/rooms/[id]/availability/route.js`
- `backend/src/app/api/admin/manage/route.js` & `handlers.js`
