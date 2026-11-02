# Context: timeUtils.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/timeUtils.js`, tüm Backend uç noktaları, rezervasyon politikası (`reservationPolicy.js`) ve yaşam döngüsü motoru (`lifecycle.js`) için merkezi **Türkiye Saat Dilimi (`Europe/Istanbul`, UTC+3)**, **PostgreSQL Sahte-UTC (`1970-01-01T...Z`)** ve **HTML Escape** yardımcı kütüphanesidir. Sunucu hangi coğrafi bölgede veya Docker konteynerinde çalışırsa çalışsın tüm tarih, saat ve Kiosk onay penceresi hesaplamalarını tek merkezden (DRY & SRP) yürütür.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Çalışma Zamanı:** Standart Node.js `Intl.DateTimeFormat` API'si (Harici NPM bağımlılığı yoktur).
- **Veritabanı Uyumluluğu:** PostgreSQL `@db.Date` (`YYYY-MM-DDT00:00:00Z`) ve `@db.Time(6)` (`1970-01-01THH:mm:ssZ`).

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Anlık Türkiye Zaman Ayrıştırıcısı (`getIstanbulTimeDetails(dateInput)`)
Verilen tarihi (varsayılan: `new Date()`) `Europe/Istanbul` saat dilimine göre ayrıştırır ve `hour === 24` gece yarısı sınır durumunu `0` olarak normalize eder:
- `dateStr`: `"en-CA"` formatında `"YYYY-MM-DD"` Türkiye tarihi.
- `todayDate`: Veritabanı `@db.Date` sorgularında kullanılan `new Date(\`\${dateStr}T00:00:00Z\`)` nesnesi.
- `hour` & `minute`: Türkiye saatiyle 0–23 saat ve 0–59 dakika değerleri.
- `totalMins`: Gece yarısından itibaren geçen toplam dakika (`hour * 60 + minute`).

### B. Sahte-UTC Saat, Tarih ve Güvenlik Formatlayıcıları (`fmtTimeUTC`, `fmtDateUTC`, `fmtMinsToTime`, `escapeHtml`)
- **`fmtTimeUTC(dt)`:** `@db.Time` alanından gelen saati `getUTCHours()` ve `getUTCMinutes()` ile `"HH:mm"` formatına çevirir. `23:59` gece yarısı bitişlerini `"24:00"` olarak döndürür.
- **`fmtDateUTC(dt, locale)`:** `@db.Date` alanını `timeZone: "UTC"` ile gün kayması olmadan okunaklı tarihe (Örn: `"01 Kasım 2026"`) dönüştürür.
- **`fmtMinsToTime(totalMins)`:** Dakika değerini `00:00 – 24:00` arasında `"HH:mm"` metnine çevirir.
- **`escapeHtml(unsafe)`:** E-posta şablonlarına gömülen kullanıcı metinlerindeki `&`, `<`, `>`, `"`, `'` karakterlerini güvenli HTML varlıklarına dönüştürür.

### C. Rezervasyon Dakika Çözümleyicisi (`parseReservationMinutesUTC(reservation)`)
Rezervasyonun `startTime` ve `endTime` alanlarını UTC üzerinden ayrıştırarak `startH`, `startM`, `endH`, `endM`, `startTotalMins` ve `endTotalMins` değerlerini döndürür (`23:59` bitişlerini `endH = 24`, `endTotalMins = 1440` olarak normalize eder).

### D. Dinamik Kiosk Yoklama Penceresi Hesaplayıcısı (`getReservationKioskWindow(reservation, todayTrStr, toleranceMinutes)`)
Normal randevular ile boşa düşen odayı ara dakikada tutan (`Walk-In`) randevuları birbirinden ayırır:
1. **Normal Randevular (`createdAt <= startTotalMins`):**
   - Kiosk kapı QR onay penceresi sabit `[startTotalMins - toleranceMinutes, startTotalMins + toleranceMinutes]` (Örn: `16:00` randevusu için `15:45 – 16:15`) aralığındadır.
2. **Ara Dakikada Tutulan Odalar (`Walk-In`, `createdInfo.dateStr === todayTrStr && createdInfo.totalMins > startTotalMins`):**
   - İlk grup gelmediği veya erken boşalttığı için ara dakikada (Örn: `16:20`'de) boşa düşen odayı tutan yeni gruba, oluşturulma anından itibaren `[createdInfo.totalMins, createdInfo.totalMins + toleranceMinutes]` (`16:20 – 16:35`) aralığında 15 dakikalık Kiosk onay penceresi tanımlar.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/lifecycle.js`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/lib/emailService.js`
- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/app/api/reservations/route.js` & `active/route.js`
- `backend/src/app/api/invitations/route.js` & `respond/route.js`
- `backend/src/app/api/rooms/route.js`
- `backend/src/app/api/admin/manage/route.js` & `handlers.js`
