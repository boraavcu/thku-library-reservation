# Context: AdminPanel.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/AdminPanel.jsx`, sistemin tüm idari, analitik ve denetim operasyonlarını tek merkezde toplayan yönetim ekranıdır. Kütüphane Görevlileri (`LIBRARIAN`), Kütüphane Müdürü (`ADMIN`) ve Bilgi İşlem Müdürlüğü Sistem Yöneticileri (`SUPER_ADMIN`) tarafından kullanılır. Yoğunluk analizleri, A4 PDF faaliyet raporu, canlı rezervasyon müdahaleleri, kurumsal `@thk.edu.tr` personel hesabı oluşturma ve geçici şifre üretimi, demo/test verilerini temizleme (`PURGE_TEST_DATA`), takvimli/kalıcı ban yönetimi ve 180 günlük denetim loglarını kapsar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama & Yönlendirme:** `next-auth/react` (`useSession`), `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **Zaman & API Yardımcıları:** `../utils/dateUtils` (`isReservationEnded`), `../api` (`GET` & `POST /api/admin/manage`)
- **Alt Sekme Bileşenleri:** `AnalyticsTab`, `ReservationsTab`, `RoomsTab`, `AnnouncementsTab`, `UsersTab`, `RulesAndLogsTab` ve `adminConstants.js`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. 3 Kademeli Rol Hiyerarşisi (RBAC)
1. **`LIBRARIAN` (Kütüphane Görevlisi):** Analizleri görüntüler, PDF rapor alır, rezervasyonlara manuel Check-In / Erken Boşaltma / No-Show / İptal uygular, odaları yeni randevuya kapatır/açar, duyuru yayınlar ve `/dashboard?studentView=true` ile öğrenci görünümüne geçebilir.
2. **`ADMIN` (Kütüphane Müdürü):** Ek olarak oda ekleyip silebilir, öğrencileri takvimli/kalıcı banlayabilir, kurumsal `@thk.edu.tr` uzantılı `LIBRARIAN` personeli oluşturup geçici şifresini sıfırlayabilir, demo verilerini temizleyebilir ve 6. sekmedeki dinamik kurallar ile 180 günlük logları yönetebilir.
3. **`SUPER_ADMIN` (BİM Sistem Yöneticisi):** En üst yetki seviyesidir; `ADMIN` ve `SUPER_ADMIN` rolü atayabilen ve bu rollerdeki kurumsal hesapları düzenleyebilen tek roldür.

### B. Kurumsal Personel Ekleme, Tek Seferlik Geçici Şifre ve Demo Veri Temizliği
- **Kurumsal Personel Ekle (`CREATE_USER`):** `createUserDialog` penceresinden yalnızca `@thk.edu.tr` (`@stu.thk.edu.tr` hariç) adresli personel eklenir. Sunucu 48 saat geçerli tek seferlik şifre üretir ve SMTP tanımlıysa e-posta kuyruğuna ekler.
- **Geçici Şifre Sıfırlama (`RESET_STAFF_TEMP_PASSWORD`):** `handleResetStaffPassword` işleyicisiyle mevcut `@thk.edu.tr` personeli için yeni bir tek seferlik geçici şifre üretilir.
- **Tek Seferlik Şifre Gösterim Penceresi (`credentialDialog`):** Üretilen geçici şifreyi ekranda yalnızca bir kez gösterir, panoya kopyalama (`navigator.clipboard.writeText`), geçerlilik bitiş tarihi (`expiresAt`) ve e-posta kuyruğu durumu (`emailQueued`) bilgilerini sunar.
- **Demo Verilerini Temizle (`PURGE_TEST_DATA`):** `purgeDialog` onay penceresi üzerinden `@demo.local` hesaplarını, örnek test kullanıcılarını, bunlara bağlı rezervasyonları ve örnek duyuruları tek tıkla temizler; gerçek kurumsal hesaplara, odalara ve sözleşmelere dokunmaz.

### C. KPI Kartları, 6 Sekmeli Yapı ve A4 PDF Raporlama
- Üst bölümdeki 5 KPI kartında `activeBookingsCount`, `isReservationEnded(r)` kontrolüyle süresi dolmuş randevuları hariç tutarak gerçek zamanlı aktif sayıyı gösterir.
- `handlePrintPdfReport` çağrıldığında sekme `0`'a (`AnalyticsTab`) geçilir ve `@media print` kurallarıyla THKÜ antetli resmi A4 Faaliyet & Yoğunluk Raporu yazdırılır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/components/admin/*` (`AnalyticsTab`, `ReservationsTab`, `RoomsTab`, `AnnouncementsTab`, `UsersTab`, `RulesAndLogsTab`, `adminConstants.js`)
- `frontend/src/utils/dateUtils.js` (`isReservationEnded`)
- `frontend/src/components/Navbar.jsx` & `Footer.jsx`
- `backend/src/app/api/admin/manage/route.js` & `handlers.js`
