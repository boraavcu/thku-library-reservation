# Context: formatTime.js

##  1. Dosyanın Amacı ve Mimari Rolü

`formatTime.js`, duyuru yayınlanma zamanlarını (`publishedAt`) veya bildirim tarihlerini kullanıcının seçtiği dile (`tr` veya `en`) göre **"az önce / just now"**, **"5 dakika önce / 5 minutes ago"**, **"3 saat önce / 3 hours ago"** şeklinde insan dostu göreceli zaman (Relative Time) metnine dönüştüren yardımcı modüldür.

##  2. İş Mantığı ve Zaman Birimi Tablosu (`UNITS_TR` & `UNITS_EN`)

`formatRelativeTime(dateStr, lang = 'tr')` fonksiyonu şu adımlarla çalışır:
1. Şu anki zaman (`Date.now()`) ile gelen tarihin milisaniye farkını saniyeye (`diff`) çevirir.
2. Eğer fark 5 saniyeden küçükse Türkçe için `'az önce'`, İngilizce için `'just now'` döndürür.
3. Farkı sırasıyla saniye (`<60`), dakika (`<3600`), saat (`<86400`), gün (`<604800`), hafta (`<2592000`), ay (`<31536000`) ve yıl (`Infinity`) dilimleriyle karşılaştırır; İngilizce için tekil (`singular: 'hour ago'`) ve çoğul (`plural: 'hours ago'`) dilbilgisi kuralını otomatik uygular.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx` (Duyuru kartlarındaki zaman gösterimi)