# Context: formatTime.js

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/utils/formatTime.js`, duyuru yayınlanma zamanlarını (`publishedAt`) ve bildirim tarihlerini aktif dile (`tr` veya `en`) göre **"az önce / just now"**, **"5 dakika önce / 5 minutes ago"**, **"3 saat önce / 3 hours ago"** biçiminde göreceli zaman (Relative Time) dizgisine dönüştüren yardımcı modüldür.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **Çalışma Zamanı:** Standart JavaScript `Date.now()` ve `Date` API'si (Harici kütüphane bağımlılığı yoktur)

## 3. İş Mantığı ve Bileşen Mimarisi

- **`UNITS_TR` ve `UNITS_EN` Zaman Dilimi Tabloları:** Saniye (`<60`), dakika (`<3600`), saat (`<86400`), gün (`<604800`), hafta (`<2592000`), ay (`<31536000`) ve yıl (`Infinity`) eşiklerini ve bölenlerini tutar.
- **`formatRelativeTime(dateStr, lang = 'tr')`:**
  1. Şu anki zaman ile hedef tarih arasındaki farkı saniye cinsinden (`diff`) hesaplar.
  2. Fark `5` saniyenin altındaysa Türkçe için `'az önce'`, İngilizce için `'just now'` döndürür.
  3. İlgili zaman dilimini bularak tam sayı değerini hesaplar ve İngilizce için tekil/çoğul (`singular` / `plural`) dilbilgisi uyumunu otomatik uygular.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx` (Duyuru kartlarındaki yayınlanma zamanı gösterimi)
