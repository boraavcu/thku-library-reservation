# Context: invitations/respond/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/invitations/respond/route.js`, davet edilen bir öğrencinin grup davetini **Kabul Et (`ACCEPT`)** veya **Reddet (`REJECT`)** olarak yanıtladığı ve yeterli sayıya ulaşıldığında rezervasyonu otomatik olarak `CONFIRMED` durumuna geçiren uç noktadır (`POST`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`, `Reservation`, `ReservationParticipant`, `AuditLog`)
- **Politika, Zaman & Yaşam Döngüsü:** `@/lib/reservationPolicy`, `@/lib/timeUtils`, `@/lib/lifecycle`

## 3. İş Mantığı, Kota Kontrolleri ve E-Posta Tetiklemesi (`POST`)

### A. Ön Güvenlik ve Davet Kabul (`ACCEPT`) Kontrolleri
`rejectIfPasswordChangeRequired(session)` ve `runReservationLifecycleChecks()` adımlarından sonra:
1. **Ban Kontrolü:** Öğrenci banlıysa (`isBanned`) daveti kabul edemez (`403 Forbidden`).
2. **Geçmiş Saat Dilimi Kontrolü:** Randevunun bitiş saati (`endTotalMins`) geçmişse davete yanıt verilemez.
3. **30 Dakika Süre Aşımı Kontrolü:** Randevunun oluşturulmasının (`createdAt`) üzerinden 30 dakikadan fazla süre geçmişse ve randevu hâlâ `PENDING` ise anında `CANCELLED` yapılır (`400`).
4. **Maksimum Oda Kapasitesi (`maxP`):** Onaylı katılımcı sayısı odanın maksimum kapasitesine (`Math.min(room.capacity, maxParticipants)`) ulaşmışsa yeni kabul engellenir.
5. **Günlük 1 Randevu ve Gece-Sabah Kuralı:** `validateDailyQuotaForUsers` ve `validateNightToMorningRuleForUsers` ile daveti kabul eden öğrencinin uygunluğu denetlenir.

### B. `PENDING -> CONFIRMED` Geçişi (`isInitialConfirmation`)
- Katılımcının durumu `ACCEPTED` olarak güncellenir.
- Toplam onaylı kişi sayısı (`1 + acceptedCount`) dinamik `minParticipants` (varsayılan 2) kuralına ulaştığında atomik `updateMany({ where: { id, status: "PENDING" } })` ile randevu **`CONFIRMED`** yapılır ve `handleParticipantAcceptedEmails` arka planda tetiklenir.

### C. Davet Reddi (`REJECT`) ve Otomatik İptal Kontrolü
- Katılımcı durumu `REJECTED` yapılır. Kalan maksimum potansiyel üye sayısı (`1 + acceptedCount + pendingCount`) `minParticipants` altına düştüyse ve randevu `PENDING` ise otomatik `CANCELLED` yapılır ve `sendReservationCancelledEmails` tetiklenir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`, `MyBookings.jsx` ve `components/Navbar.jsx`
- `backend/src/lib/passwordGate.js` & `backend/src/lib/reservationPolicy.js`
- `backend/src/lib/timeUtils.js` & `backend/src/lib/lifecycle.js`
