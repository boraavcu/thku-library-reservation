# Context: dateUtils.js

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/utils/dateUtils.js`, Frontend katmanındaki tüm sayfa ve bileşenlerin (Rezervasyon formu, oda keşif ekranı, randevularım, yönetici paneli) tarayıcının çalıştığı yerel saat diliminden (örneğin kullanıcının bilgisayarı İngiltere veya Amerika saatinde olsa dahi) bağımsız olarak **Türkiye yerel saatine (`Europe/Istanbul`)** göre çalışmasını sağlayan ortak zaman motorudur.

`getIstanbulNowParts` ve geriye dönük uyumluluk alias'ı olan `getIstanbulNowInfo` ile `ReserveForm.jsx` ve `StudyRooms.jsx` sayfalarının çalışma zamanı çökmesini (White Screen of Death) önler.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Çalışma Zamanı:** Standart modern JavaScript `Intl.DateTimeFormat` API'si.
- **Biçimlendirme Standardı:** ISO 8601 (`YYYY-MM-DD`) ve 24 saatlik UTC zaman formatı (`HH:mm`).

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Anlık Türkiye Saati Ayrıştırıcısı (`getIstanbulNowParts` & `getIstanbulNowInfo`)
Tarayıcının yerel saatini ezerek `Europe/Istanbul` saat dilimindeki tam tarihi ve dakikayı çıkarır (`hour === 24` gece yarısı sınır durumunu `0` olarak normalize eder):
- `todayIso` / `todayStr`: `"en-CA"` formatında `"YYYY-MM-DD"` Türkiye tarihi (Örn: `"2026-11-01"`).
- `hour` & `minute`: Türkiye saati ile 0-23 ve 0-59 tamsayıları.
- `nowMinutes`: Gün başlangıcından itibaren geçen toplam dakika (`hour * 60 + minute`).

### B. Tarih Dizgisi Üreticisi (`toDateStr`)
JavaScript `Date` nesnesini yerel saat kaymalarından etkilenmeden `"YYYY-MM-DD"` formatına dönüştürür.

### C. Gelecek Tarih Sınır Hesaplayıcısı (`getFutureDateStr`)
Bugünün üzerine sistem kuralındaki `daysToAdd` (Örn: `maxAdvanceDays = 1`) gününü ekleyerek takvim girişinin maksimum `max` sınırını belirler (`YYYY-MM-DD`).

### D. Sahte-UTC Saat ve Tarih Formatlayıcıları (`fmtTimeUTC`, `fmtDateShortUTC`, `fmtDateLongUTC`)
- **`fmtTimeUTC(timeStr)`:** PostgreSQL `@db.Time` sahte-UTC saatini `"HH:mm"` olarak formatlar. 23:59 ve üzeri değerleri görsel olarak `"24:00"` kütüphane kapanış saati olarak sunar.
- **`fmtDateShortUTC` / `fmtDateLongUTC`:** Rezervasyon tarihlerini kullanıcının seçtiği dile (`tr` veya `en`) göre `timeZone: "UTC"` ile kayıpsız biçimlendirir (Örn: `"1 Kas 2026"` veya `"1 November 2026"`).

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx`
- `frontend/src/pages/ReserveForm.jsx`
- `frontend/src/pages/MyBookings.jsx`
- `frontend/src/pages/AdminPanel.jsx`
- `frontend/src/components/admin/ReservationsTab.jsx`
