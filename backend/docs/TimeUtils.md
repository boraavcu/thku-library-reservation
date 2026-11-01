## 1. Dosyanın Amacı ve Mimari Rolü

`timeUtils.js`, tüm Backend genelinde saat ve tarih işlemlerinin **tek doğruluk kaynağıdır (Single Source of Truth)**. Sunucunun çalıştığı fiziksel makinenin veya Docker container'ının yerel işletim sistemi saat diliminden (UTC+0, GMT vb.) bağımsız olarak tüm randevu saatlerini, süre farklarını ve veritabanı karşılaştırmalarını Türkiye yerel saatine (`Europe/Istanbul`, UTC+3) sabitler.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Çalışma Zamanı:** Standart Node.js / JavaScript `Intl.DateTimeFormat` API'si (Dış NPM bağımlılığı yoktur).
- **Hedef Veritabanı Tipleri:** PostgreSQL `@db.Date` (`YYYY-MM-DDT00:00:00.000Z`) ve `@db.Time` (`1970-01-01THH:mm:ss.000Z` Sahte-UTC).

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Anlık Zaman Bilgisi Sağlayıcı (`getIstanbulTimeDetails`)
Sistemin şu anki zaman damgasına göre Türkiye saat dilimini ayrıştırır ve veritabanı filtrelerinde kullanılacak nesneleri üretir:
- `todayDateStr`: `"YYYY-MM-DD"` formatında string (Örn: `"2026-11-01"`).
- `todayDate`: `YYYY-MM-DDT00:00:00.000Z` sahte-UTC `Date` nesnesi (Prisma `@db.Date` eşitlik sorguları için).
- `yesterdayDate`: Dünün gece yarısı sahte-UTC nesnesi (Gece yarısı tolerans denetimleri için).
- `tomorrowDate`: Yarının gece yarısı sahte-UTC nesnesi.
- `currentHour` & `currentMinute`: Türkiye saati ile 0-23 ve 0-59 arası tamsayılar.
- `currentEpochMins`: Gece yarısından itibaren geçen net dakika (`hour * 60 + minute`).

### B. Sahte-UTC Saat Dönüştürücü (`timeStrToFakeUtc`)
Frontend'den gelen `"HH:mm"` veya `"HH:mm:ss"` saat dizgilerini PostgreSQL `@db.Time` kolonuna uygun `1970-01-01THH:mm:00.000Z` nesnesine çevirir.
- **24:00 Özel Durumu:** Kütüphane kapanış saati olan `"24:00"` girişi geldiğinde tarih kaymasını önlemek için `1970-01-01T23:59:59.999Z` olarak normalize edilir.

### C. Epoch Dakikası Hesaplayıcı (`fakeUtcToEpochMinutes`)
Prisma'dan dönen `@db.Time` alanının saat ve dakika değerlerini UTC üzerinden okuyarak (`getUTCHours() * 60 + getUTCMinutes()`) günün kaçıncı dakikası olduğunu hesaplar. Böylece yerel saat dilimi kaymaları engellenir.

### D. İki Saat Arasındaki Süre Farkı (`timeDiffMinutes`)
Başlangıç ve bitiş `@db.Time` nesneleri arasındaki net süreyi dakika cinsinden hesaplar (`endEpochMins - startEpochMins`).

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/lifecycle.js`
- `backend/src/lib/penaltyService.js`
- `backend/src/lib/kioskSecurity.js`
- `backend/src/app/api/reservations/route.js`
- `backend/src/app/api/rooms/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/app/api/admin/manage/handlers.js`