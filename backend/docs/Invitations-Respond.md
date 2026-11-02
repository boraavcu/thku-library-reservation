# Context: invitations/respond/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/invitations/respond/route.js`, davet edilen bir öğrencinin grup davetini **Kabul Et (`ACCEPT`)** veya **Reddet (`REJECT`)** olarak yanıtladığı ve yeterli sayıya ulaşıldığında rezervasyonu otomatik olarak `CONFIRMED` durumuna geçiren uç noktadır (`POST`).

##  2. İş Mantığı, Kota Kontrolleri ve Asenkron E-Posta Tetiklemesi

### A. Davet Kabul (`ACCEPT`) Kontrolleri
Öğrenci daveti kabul ettiğinde şu güvenlik ve kota kontrolleri yapılır:
1. **Ban Kontrolü:** Öğrenci banlıysa (`isBanned`) daveti kabul edemez (`403 Forbidden`).
2. **Geçmiş Saat Dilimi Kontrolü:** Randevunun bitiş saati (`endTotalMins`) geçmişse davete yanıt verilemez.
3. **30 Dakika Süre Aşımı Kontrolü:** Randevunun oluşturulmasının (`createdAt`) üzerinden 30 dakikadan fazla süre geçmişse ve randevu hâlâ `PENDING` ise, randevu anında `CANCELLED` yapılır ve `400` hatası döndürülür.
4. **Maksimum Oda Kapasitesi Kontrolü (`maxP`):** Onaylı katılımcı sayısı odanın maksimum kapasitesine (`Math.min(room.capacity, maxParticipants)`) ulaşmışsa yeni kabul engellenir.
5. **Günlük 1 Randevu ve Gece-Gündüz Kuralı (`@/lib/reservationPolicy`):** `validateDailyQuotaForUsers` ve `validateNightToMorningRuleForUsers` ile daveti kabul eden öğrencinin o gün başka bir randevusu olup olmadığı veya gece/sabah ardışık kuralına takılıp takılmadığı denetlenir.

### B. `PENDING -> CONFIRMED` Geçişi ve 2. Kişi Onay Kuralı (`isInitialConfirmation`)
- Katılımcının durumu `ACCEPTED` olarak güncellenir.
- Toplam onaylı kişi sayısı (`totalConfirmed = 1 + acceptedCount`), dinamik `MIN_PARTICIPANTS` (varsayılan 2) kuralına ulaştığında:
  - Atomik `updateMany({ where: { id, status: "PENDING" } })` ile randevu durumu **`CONFIRMED`** yapılır.
  - Arayüzün beklememesi için `handleParticipantAcceptedEmails` fonksiyonu arka planda asenkron (`.catch()`) çalıştırılır. Yalnızca `isInitialConfirmation === true` olduğunda Kütüphane Müdürüne **"[Kütüphane Müdürlüğü] Oda Ayrıldı"** maili gider.

### C. Davet Reddi (`REJECT`) ve Otomatik İptal Kontrolü
- Öğrenci daveti reddederse durumu `REJECTED` yapılır.
- Geriye kalan maksimum potansiyel kişi sayısı (`1 + acceptedCount + pendingCount`) `minParticipants` (2) değerinin altına düştüyse ve randevu hâlâ `PENDING` ise, randevu otomatik olarak `CANCELLED` yapılır ve organizatöre bilgi maili gönderilir.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`, `MyBookings.jsx` ve `components/Navbar.jsx`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/lib/timeUtils.js`
- `backend/src/lib/lifecycle.js`
