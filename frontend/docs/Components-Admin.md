# Context: frontend/src/components/admin/*

## 1. Bileşenlerin Amacı ve Mimari Rolü

Yönetim Panelinin (`AdminPanel.jsx`) her bir fonksiyonel sekmesini **Tek Sorumluluk Prensibi (SRP)** doğrultusunda bağımsız alt bileşenlere ayırarak kod tekrarını önlemek, okunabilirliği ve bakım kolaylığını maksimize etmek.

## 2. Modüllerin Görev Dağılımı ve İş Mantığı

### A. `adminConstants.js` (Ortak Sabitler ve Formatlayıcılar)
- `THKU_LOGO_URL`, `STAFF_ROLES` (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`), `ITEMS_PER_PAGE` (`10`) ve 7 dinamik rezervasyon kuralının TR/EN açıklamalarını (`RULE_META`) barındırır.
- `fmtTimeUTC`, `fmtDateShortUTC`, `fmtDateTimeTR` tarih/saat yardımcıları ile `AuditLog` ve `AdminAction` kayıtlarını insan tarafından okunabilir kartlara dönüştüren `formatAuditLog()` ve `formatAdminAction()` fonksiyonlarını içerir.

### B. `AnalyticsTab.jsx` (Sekme 0: Yoğunluk & Doluluk Analizi + A4 PDF Raporu)
- Gelecek 1 saatlik canlı operasyon radarını (`activeNowRooms`, `upcomingHourReservations`, `upcomingHourStudents`), randevu gerçekleşme/iptal/No-Show oranlarını, `RoomDensityChart` bileşenini, bölüm bazlı dağılımı, oda tercih sıralamasını ve 24 saatlik yoğunluk ısı haritasını (`hourlyHeatmap`) render eder.
- A4 PDF Faaliyet Raporu yazdırma (`onPrintPdf`) butonunu ve resmi imza alanlarını içerir.

### C. `ReservationsTab.jsx` (Sekme 1: Canlı Rezervasyon Yönetimi)
- Rezervasyonları öğrenci adı, e-posta, telefon numarası (`📞`), bölüm, oda ve duruma göre filtreler ve sayfalar (`Pagination`).
- Görevli ve yöneticilere tek tıkla `FORCE_CHECKIN` (Manuel Check-In), `EARLY_FINISH` (Erken Boşalt), `MARK_NO_SHOW` (No-Show Uyarısı Ver) ve `CANCEL` (İptal Et) aksiyonlarını sunar.

### D. `RoomsTab.jsx` (Sekme 2: Oda Yönetimi)
- Odaların kapasite, açıklama ve aktiflik durumlarını listeler; görevlilere odayı geçici olarak yeni randevuya kapatma (`TOGGLE_ROOM`) imkanı verir.
- `ADMIN` ve `SUPER_ADMIN` için yeni oda ekleme (`CREATE_ROOM`), düzenleme (`UPDATE_ROOM` modalı) ve silme (`DELETE_ROOM`) işlemlerini yönetir.

### E. `AnnouncementsTab.jsx` (Sekme 3: Duyuru Yayınlama)
- Türkçe ve İngilizce başlık/içerik ile `LOW`, `MEDIUM`, `HIGH`, `URGENT` önceliklerinde duyuru yayınlama (`CREATE_ANNOUNCEMENT`) ve silme (`DELETE_ANNOUNCEMENT`) işlemlerini kendi yerel form state'i ile yönetir.

### F. `UsersTab.jsx` (Sekme 4: Öğrenciler, Ban & Yetkiler)
- Kullanıcıları arama, rol/ban filtreleme ve sayfalama ile listeler; `No-Show: X / 3` rozetlerini gösterir.
- **Takvimli ve Kalıcı Ban Modalı (`banDialog`):** `+7`, `+14`, `+30`, `+90` gün hızlı seçim çipleri, özel tarih seçici (`DATE`) ve kalıcı (`PERMANENT`) ban seçenekleriyle `BAN_USER`, `UNBAN`, `RESET_PENALTY` ve rol hiyerarşisine uygun `CHANGE_ROLE` aksiyonlarını yürütür.

### G. `RulesAndLogsTab.jsx` (Sekme 5: Dinamik Kurallar & 180 Günlük Loglar)
- 7 dinamik rezervasyon kuralını (`RULE_META`) artırma/azaltma butonlarıyla canlı günceller (`UPDATE_RULE`).
- 180 günlük Öğrenci & Sistem Logları (`auditLogs`) ile Yönetici Müdahale Loglarını (`adminActions`) iki simetrik sütunda ve sayfalama (`Pagination`) ile sunar.

## 3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/AdminPanel.jsx`
- `backend/src/app/api/admin/manage/route.js` & `handlers.js`
