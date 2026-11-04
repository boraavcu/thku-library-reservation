# Context: dateUtils.js

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/utils/dateUtils.js`, istemci katmanındaki tüm sayfa ve bileşenlerin kullanıcının cihazındaki yerel saat diliminden bağımsız olarak **Türkiye saati (`Europe/Istanbul`)** ve PostgreSQL'deki sahte-UTC (`@db.Time` / `@db.Date`) zaman temsilleriyle birebir uyumlu çalışmasını sağlayan merkezi tarih/saat yardımcı modülüdür.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **Çalışma Zamanı:** Standart JavaScript `Date` ve `Intl.DateTimeFormat` (`timeZone: "Europe/Istanbul"` ve `timeZone: "UTC"`) API'leri
- **Biçimlendirme Standardı:** ISO 8601 (`YYYY-MM-DD`) ve 24 saatlik zaman gösterimi (`00:00` – `24:00`)

## 3. İş Mantığı ve Bileşen Mimarisi

1. **`toDateStr(d)`:** Verilen `Date` nesnesini yerel yıl/ay/gün bileşenleriyle `"YYYY-MM-DD"` dizgisine dönüştürür.
2. **`getIstanbulNowParts()` ve `getIstanbulNowInfo()`:**
   - `Europe/Istanbul` saat dilimindeki güncel tarihi (`todayIso` / `todayStr`), saati (`hour`), dakikayı (`minute`) ve gün başlangıcından itibaren geçen toplam dakikayı (`nowMinutes = hour * 60 + minute`) hesaplar.
   - `getIstanbulNowInfo()`, `StudyRooms.jsx` ve `ReserveForm.jsx` bileşenleriyle uyumluluk sağlayan doğrudan takma addır (alias).
3. **`isReservationEnded(res)`:**
   - Bir rezervasyonun bitiş zamanının (`reservationDate` + `endTime`) `Europe/Istanbul` saatine göre geçip geçmediğini kontrol eder (`23:59` kapanış saatini `24:00` yani `1440.` dakika olarak normalize eder).
   - Arka uç yaşam döngüsü senkronizasyonuna ek olarak istemci tarafında da (`MyBookings.jsx`, `AdminPanel.jsx`, `ReservationsTab.jsx`) süresi dolan randevuların anında "Tamamlandı / Geçmiş" olarak sınıflandırılmasını garanti eder.
4. **`getFutureDateStr(daysToAdd)`:**
   - Türkiye bugünü (`todayIso`) üzerine belirtilen gün sayısını ekleyerek ileri tarih sınırlarını (`maxSelectableDate`, ban bitiş tarihi vb.) `"YYYY-MM-DD"` formatında üretir.
5. **`fmtTimeUTC(timeStr)`, `fmtDateShortUTC(dateStr, isEn)` ve `fmtDateLongUTC(dateStr, isEn)`:**
   - `fmtTimeUTC`: Veritabanından gelen UTC saatini `"HH:mm"` formatına çevirir (`23:59` ve üzerini `"24:00"` olarak gösterir).
   - `fmtDateShortUTC` & `fmtDateLongUTC`: Tarihleri saat dilimi kayması olmadan (`timeZone: "UTC"`) seçili dile (`tr-TR` / `en-US`) göre kısa veya uzun biçimde formatlar.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx`
- `frontend/src/pages/ReserveForm.jsx`
- `frontend/src/pages/MyBookings.jsx`
- `frontend/src/pages/AdminPanel.jsx`
- `frontend/src/components/admin/ReservationsTab.jsx`
- `frontend/src/components/admin/UsersTab.jsx`
