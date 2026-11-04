# Context: frontend/src/components/admin/*

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/components/admin/` dizinindeki modüller, Yönetim Panelinin (`AdminPanel.jsx`) her bir fonksiyonel sekmesini **Tek Sorumluluk Prensibi (SRP)** doğrultusunda bağımsız alt bileşenlere ayırarak okunabilirliği, sürdürülebilirliği ve performanslı durum yönetimini sağlar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Tarih ve Saat Yardımcıları:** `../../utils/dateUtils` (`fmtTimeUTC`, `fmtDateShortUTC`, `getFutureDateStr`, `isReservationEnded`)
- **Analitik Bileşen:** `../dashboard/RoomDensityChart`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. `adminConstants.js` (Ortak Sabitler ve Denetim Logu Formatlayıcıları)
- `THKU_LOGO_URL`, `STAFF_ROLES` (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`), `ITEMS_PER_PAGE` (`10`), bölüm çeviri haritası (`DEPT_EN_MAP`) ve 7 dinamik rezervasyon kuralının `TR`/`EN` üst verilerini (`RULE_META`) içerir.
- `formatAuditLog(log, isEn)` fonksiyonu ile öğrenci ve sistem hareketlerini (`RESERVATION_CREATED`, `RESERVATION_CHECKED_IN`, `AUTO_NO_SHOW_PENALTY`, `AUTO_NO_SHOW_BANNED`, `AUTO_KIOSK_CANCELLED`, `AUTO_TIMEOUT_CANCELLED`, `RESERVATION_EARLY_CHECKOUT` vb.) renkli rozet ve anlaşılır metinlere dönüştürür.

### B. `AnalyticsTab.jsx` (Sekme 0: Yoğunluk & Doluluk Analizi + A4 PDF Raporu)
- Gelecek 1 saatlik canlı operasyon radarını (`activeNowRooms`, `upcomingHourReservations`, `upcomingHourStudents`), gerçekleşme/iptal/No-Show oranlarını, `RoomDensityChart` grafiğini, bölüm bazlı kullanım dağılımını, oda tercih sıralamasını ve 7/24 saatlik yoğunluk ısı haritasını (`hourlyHeatmap`) A4 yazdırma korumalı (`breakInside: 'avoid'`) olarak render eder.

### C. `ReservationsTab.jsx` (Sekme 1: Canlı Rezervasyon Yönetimi)
- Öğrenci adı, e-posta, telefon numarası (`📞`), öğrenci numarası, bölüm, oda kodu ve çalışma amacına göre anlık arama ve sayfalama sunar.
- **`isReservationEnded(r)` Bitiş Saati Kontrolü:** Veritabanı durumu henüz `CONFIRMED` veya `CHECKED_IN` olsa bile bitiş saati (`Europe/Istanbul`) geçmiş randevuları anında **Tamamlananlar (`COMPLETED`)** filtresine taşır, rozetini `COMPLETED` olarak gösterir ve canlı müdahale butonlarını (`hasActions`) gizler.
- Aktif randevular için `FORCE_CHECKIN`, `EARLY_FINISH`, `MARK_NO_SHOW` ve `CANCEL` operasyonlarını yürütür.

### D. `RoomsTab.jsx` (Sekme 2: Oda Yönetimi)
- Mevcut onaylı randevuları iptal etmeden odayı yeni rezervasyonlara açıp kapatma (`TOGGLE_ROOM`) anahtarını sunar.
- `ADMIN` ve `SUPER_ADMIN` yetkisiyle yeni oda ekleme (`CREATE_ROOM`), düzenleme (`UPDATE_ROOM` penceresi) ve silme (`DELETE_ROOM`) işlemlerini gerçekleştirir.

### E. `AnnouncementsTab.jsx` (Sekme 3: Duyuru Yayınlama)
- Türkçe ve isteğe bağlı İngilizce başlık/içerik ile `LOW`, `MEDIUM`, `HIGH`, `URGENT` önceliklerinde duyuru oluşturma (`CREATE_ANNOUNCEMENT`) ve silme (`DELETE_ANNOUNCEMENT`) ekranıdır.

### F. `UsersTab.jsx` (Sekme 4: Öğrenciler, Ban & Kurumsal Personel Yönetimi)
- **Öğrenci Moderasyonu:** Öğrencileri arama ve sayfalama ile listeler; `No-Show: X / 3` sayaçlarını sıfırlama (`RESET_PENALTY`), takvimli (`+7`, `+14`, `+30`, `+90` gün çipleri veya özel tarih) ya da kalıcı (`PERMANENT`) banlama (`BAN_USER`), ban kaldırma (`UNBAN`) ve rol değiştirme (`CHANGE_ROLE`) aksiyonlarını barındırır.
- **Kurumsal Personel (`@thk.edu.tr`) ve Hesap Durumu Yönetimi:**
  - Üst bölümdeki **"Personel Ekle (`@thk.edu.tr`)"** butonuyla `AdminPanel.jsx` üzerindeki kurumsal hesap oluşturma modalını tetikler (`onOpenCreateStaff`).
  - Yetkili kartlarında hesabın **`AKTİF` / `PASİF`** durum rozetini ve **Hesap Durumu (`SET_STAFF_ACTIVE`)** anahtarını (`Switch`) sunar *(yöneticinin kendi hesabını yanlışlıkla pasifleştirmesini önlemek için `u.id === currentUserId` durumunda anahtar kilitlidir)*.
  - Kurumsal `@thk.edu.tr` (`@stu.thk.edu.tr` hariç) personeli için **"Yeni geçici şifre üret"** butonunu (`onResetStaffPassword`) gösterir ve tek gösterimlik şifre kopyalama akışını başlatır.

### G. `RulesAndLogsTab.jsx` (Sekme 5: Dinamik Kurallar & 180 Günlük Loglar)
- `RULE_META` kapsamındaki 7 sistem kuralını alt/üst sınırlar dahilinde azaltıp artırarak anında günceller (`UPDATE_RULE`).
- Son 180 günün Öğrenci & Sistem Logları ile Yönetici Müdahale Loglarını (ve 1 yıllık arşiv kayıt sayısını) iki simetrik sütunda arama ve sayfalama desteğiyle listeler.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/AdminPanel.jsx`
- `frontend/src/utils/dateUtils.js`
- `backend/src/app/api/admin/manage/route.js` & `handlers.js`
