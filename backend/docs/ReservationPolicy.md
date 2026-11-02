# Context: reservationPolicy.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/reservationPolicy.js`, rezervasyon iş kurallarını, günlük kota denetimlerini, gece-sabah ardışık rezervasyon kısıtlamalarını ve banlanan kullanıcıların aktif randevularının düşürülmesi/gruptan çıkarılması mantığını tek bir merkezde toplayan **SOLID Politika ve Kural Servisidir (Single Responsibility & DRY)**.

Daha önce 6 farklı uç noktada (`reservations/route.js`, `invitations/respond/route.js`, `reserve/init/route.js`, `rooms/route.js`, `lifecycle.js`, `admin/manage/handlers.js`) tekrarlanan kural okuma ve kota doğrulama sorguları bu modülde birleştirilmiştir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `ReservationRule`, `Reservation`, `ReservationParticipant`)
- **Zaman Modülü:** `@/lib/timeUtils` (`getIstanbulTimeDetails`, `parseReservationMinutesUTC`)
- **E-Posta Servisi:** `@/lib/emailService` (`sendReservationCancelledEmails`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. 7 Dinamik Rezervasyon Kuralı Okuyucusu (`getActiveReservationRules(dbClient)`)
Veritabanındaki `ReservationRule` tablosundan aktif kuralları (`isActive: true`) tek sorguda çeker ve güvenli varsayılan (`DEFAULT_RULES`) değerlerle birleştirerek döndürür:
- `maxDurationHours`: Maksimum rezervasyon süresi (Varsayılan: `3` saat)
- `maxAdvanceDays`: İleri tarihli randevu sınırı (Varsayılan: `1` gün)
- `minParticipants`: Minimum grup üyesi sayısı (Varsayılan: `2` kişi)
- `maxParticipants`: Maksimum grup üyesi sayısı (Varsayılan: `8` kişi)
- `dailyReleaseHour`: Yeni gün kotasının açılış saati (Varsayılan: `8` -> `08:00`)
- `checkinToleranceMinutes`: Kapı QR yoklama tolerans süresi (Varsayılan: `15` dk)
- `cancelLockMinutes`: Başlangıca kaç dakika kala iptalin kilitleneceği (Varsayılan: `60` dk)

### B. Günlük 1 Rezervasyon Kotası Denetimi (`validateDailyQuotaForUsers`)
Organizatör ve davet edilen tüm katılımcılar için (`userIds`) aynı gün içinde (`reservationDateObj`) durumu `PENDING`, `CONFIRMED`, `CHECKED_IN` veya `COMPLETED` olan başka bir rezervasyonun bulunup bulunmadığını denetler:
- İhlal eden kullanıcı organizatör ise (`violatingUser.id === creatorId`) kişisel kota hatası, davet edilen bir grup arkadaşı ise ilgili öğrencinin adını ve e-postasını belirten detaylı hata mesajı döndürür.

### C. Gece 21:00–24:00 ile Sabah 00:00–08:00 Ardışık Kural Denetimi (`validateNightToMorningRuleForUsers`)
7/24 açık kütüphanede bir grubun gece kapanış (`21:00 – 24:00`) ile ertesi sabah açılış (`00:00 – 08:00`) saatlerini arka arkaya kapatmasını engeller:
1. **Sabah (`00:00 – 08:00`) Randevusu Alınırken:** Bir önceki gün (`prevDateObj`) `21:00 – 24:00` (`endTotalMins > 1260`) aralığında randevusu olan üye varsa engeller.
2. **Gece (`21:00 – 24:00`) Randevusu Alınırken:** Ertesi gün (`nextDateObj`) `00:00 – 08:00` (`startTotalMins < 480`) aralığında randevusu olan üye varsa engeller.

### D. Banlanan Öğrencinin Randevularını Düşürme / Gruptan Çıkarma (`cancelOrRemoveBannedUserReservations`)
Hem `penaltyService.js` (`3/3 No-Show` otomatik ban) hem de `admin/manage/handlers.js` (`BAN_USER` manuel ban) tarafından ortak kullanılır:
1. **Öğrencinin Organizatör Olduğu Randevular:** Bugünün henüz bitmemiş ve gelecek günlerin tüm `PENDING`/`CONFIRMED` randevularını `CANCELLED` yapar ve gruba iptal e-postası gönderir.
2. **Öğrencinin Davetli Katılımcı Olduğu Randevular:**
   - Banlanan öğrencinin katılım durumunu `REJECTED` yapar (böylece diğer masum grup üyelerinin randevusu gereksiz yere iptal edilmez).
   - Eğer banlanan öğrenci gruptan çıkarıldığında kalan potansiyel kişi sayısı `minParticipants` (2) altına düşüyorsa, o zaman randevuyu otomatik `CANCELLED` yapar ve organizatörü bilgilendirir.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/reservations/route.js`
- `backend/src/app/api/invitations/respond/route.js`
- `backend/src/app/api/reserve/init/route.js`
- `backend/src/app/api/rooms/route.js`
- `backend/src/lib/lifecycle.js`
- `backend/src/lib/penaltyService.js`
- `backend/src/app/api/admin/manage/handlers.js`

