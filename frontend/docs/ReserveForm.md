# Context: ReserveForm.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`ReserveForm.jsx`, öğrencilerin seçtikleri çalışma odası için tarih ve saat aralığı belirlediği (**Adım 1**) ve ardından çalışma amacını girip grup arkadaşlarını davet ederek zorunlu kullanım kurallarını onayladığı (**Adım 2**) iki aşamalı rezervasyon oluşturma sihirbazıdır.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`) 
- **Yönlendirme & URL Parametreleri:** `react-router-dom` (`useNavigate`, `useSearchParams` ile `roomId` ve `date` okuma) 
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN`) 
- **API İstemcisi:** `../api` (`/reserve/init`, `/rooms/[id]/availability`, `POST /reservations`) 

## 3. İş Mantığı ve Kritik Saat / Kapasite Kuralları

### A. Dinamik Kural ve Müsaitlik Yükleme
- Sayfa açıldığında `GET /api/reserve/init` çağrılarak odanın bilgisi ve veritabanındaki 7 dinamik kural (`minParticipants`, `maxParticipants`, `maxDurationHours`, `maxAdvanceDays`, `checkinToleranceMinutes`, `cancelLockMinutes`) `rules` state'ine yüklenir.
- Tarih veya oda değiştiğinde `GET /api/rooms/${roomId}/availability?date=${date}` uç noktası çağrılarak o günkü dolu saat dilimleri (`occupiedSlots`) çekilir.

### B. 7/24 Takvim Izgarası ve "Boşa Düşen Odayı Anında Tutma" Mantığı (`isSlotPast`)
- Kütüphane 7/24 açık olduğu için saat ızgarası `HOUR_START = 0` ile `HOUR_END = 24` arasında 24 saatlik dilimler halinde çizilir . Gece yarısı bitişleri (`23:59`) otomatik olarak `24:00` (`endH = 24`) şeklinde normalize edilir.
- **Kritik Saat Kuralı (`(hour + 1) * 60 <= nowMinutes`):** Geçmiş saat kontrolü yapılırken içinde bulunulan saat dilimi **henüz bitmediyse** (`(hour + 1) * 60 > nowMinutes`) o saat dilimi kilitlenmez.
  - *Neden Bu Şekilde Tasarlandı?* Örneğin saat `16:00 - 18:00` randevusu olan bir grup kapı QR kodunu `16:15`'e kadar okutmadığı için `16:16`'da sistem odayı otomatik `NO_SHOW` yapıp boşa düşürdüğünde (veya bir grup odayı `16:20`'de erken boşalttığında), saat `16:20`'de kütüphaneye gelen yeni bir grup `17:00`'ı beklemek zorunda kalmadan doğrudan `16:00 - 18:00` (veya `16:00 - 19:00`) dilimini seçip odaya girebilir.

### C. Katılımcı Ekleme ve `pendingTypedEmail` Koruması (Adım 2)
- Öğrenci çalışma amacını serbest metin olarak yazabileceği gibi 5 hazır çipten (`PURPOSE_PRESETS_TR` / `PURPOSE_PRESETS_EN`) birine tıklayarak da hızlıca seçebilir.
- **Kullanıcı Deneyimi Koruması (`effectiveParticipants`):** Öğrenci davet edeceği arkadaşının e-postasını metin kutusuna yazıp **"Ekle" butonuna basmayı unutsa bile**, `hasValidTypedEmail` kontrolü sayesinde kutudaki geçerli e-posta otomatik olarak katılımcı listesine (`effectiveParticipants`) dahil edilir ve kapasite çubuğunu günceller.
- Toplam kişi sayısı (`totalPeople = effectiveParticipants.length + 1`), `minRequiredPeople` (varsayılan 2) ile `effectiveMax` (varsayılan 8) arasında değilse onay butonu aktif olmaz.

### D. 4 Maddelik Zorunlu Kurallar Onay Kutucuğu (`rulesConfirmed`)
- Rezervasyonun oluşturulabilmesi için öğrencinin en alttaki onay kutucuğunu (`rulesConfirmed`) işaretlemesi zorunludur. Bu kutucukta dinamik olarak:
  1. **30 Dakika Davet Onay Süresi**,
  2. **Son 1 Saat (`cancelLockMins` dk) İptal Kilidi**,
  3. **±`checkinToleranceMins` Dakika Kapı QR Yoklama ve Kişisel Cihaz Zorunluluğu**,
  4. **1/3 No-Show Uyarısı ve 3/3 (30 Gün) Ban Kuralı** açıkça beyan edilir.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/reserve/init/route.js` (`GET`) 
- `backend/src/app/api/rooms/[id]/availability/route.js` (`GET`) 
- `backend/src/app/api/reservations/route.js` (`POST`) 