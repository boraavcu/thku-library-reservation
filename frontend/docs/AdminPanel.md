# Context: AdminPanel.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`AdminPanel.jsx`, **THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi**'nin yönetim, denetim, analitik ve moderasyon merkezidir . Kütüphane Görevlileri (`LIBRARIAN`), Kütüphane Müdürü (`ADMIN`) ve Bilgi İşlem Müdürlüğü Sistem Yöneticileri (`SUPER_ADMIN`) tarafından kullanılır . Oda doluluk analizlerinden A4 PDF faaliyet raporu çıktısına, canlı rezervasyon müdahalelerinden takvimli/kalıcı ban yönetimine ve 7 dinamik sistem kuralından 180 günlük denetim loglarına kadar tüm idari operasyonları tek bir ekranda toplar .

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Kimlik Doğrulama & Yetki:** `next-auth/react` (`useSession`) 
- **Yönlendirme:** `react-router-dom` (`useNavigate`) 
- **Çoklu Dil (i18n):** `react-i18next` (`isEn` kontrolü ve `DEPT_EN_MAP` ile bölüm isimlerinin dinamik İngilizce çevirisi) 
- **Alt Bileşenler:** `Navbar.jsx`, `Footer.jsx`, `RoomDensityChart.jsx` 
- **API İstemcisi:** `../api` (`GET /api/admin/manage` ve `POST /api/admin/manage`) 

##  3. Rol Hiyerarşisi ve Güvenlik Korumaları (RBAC & Security)

Sayfa yüklendiğinde `STAFF_ROLES = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN']` kontrolü yapılır; yetkisiz kullanıcılar veya öğrenciler anında `/dashboard` sayfasına yönlendirilir . Kendi içinde 3 kademeli yetki ayrımı uygulanır :

1. **`isLibrarianOnly` (`LIBRARIAN` - Kütüphane Görevlisi):**
   - Yoğunluk analizlerini görebilir, PDF rapor alabilir, rezervasyonlara manuel Check-In / Erken Boşaltma / No-Show / İptal müdahalesi yapabilir, odaları geçici olarak yeni randevuya kapatabilir (`Switch`) ve duyuru yayınlayabilir .
   - Üst barda yalnızca görevlilere özel **"Öğrenci Ekranı (Rezervasyon Yap)"** (`/dashboard?studentView=true`) geçiş butonu bulunur .
   - Oda ekleyemez/silemez, öğrencileri banlayamaz, rol değiştiremez ve 5. sekmeyi (Kurallar & Loglar) göremez .
2. **`isAdminOrSuper` (`ADMIN` - Kütüphane Müdürü & `SUPER_ADMIN` - BİM):**
   - Yeni çalışma odası ekleyebilir, oda adını/kapasitesini düzenleyebilir, odayı kalıcı silebilir .
   - Öğrencilerin uyarı sayaçlarını sıfırlayabilir, takvimli veya kalıcı (Perma) ban atabilir ve ban kaldırabilir .
   - 7 dinamik rezervasyon kuralını değiştirebilir ve son 180 günün Öğrenci/Yönetici loglarını inceleyebilir .
   - `ADMIN` rolü öğrencileri `LIBRARIAN` (Görevli) yapabilir ancak başka bir `ADMIN` veya `SUPER_ADMIN` atayamaz ve onların yetkisini değiştiremez .
3. **`isSuperAdmin` (`SUPER_ADMIN` - BİM Sistem Yöneticisi):**
   - Sistemdeki en üst yetkidir; `ADMIN` (Kütüphane Müdürü) ve `SUPER_ADMIN` (BİM) ataması yapabilen tek roldür .

##  4. Sekme (Tab) Mimarisi ve İşlevleri

Üst kısımda 5 adet özet KPI kartı (*Aktif Çalışma Odası*, *Aktif/Bekleyen Randevu*, *Zirve Yoğunluk Saati*, *Kayıtlı Öğrenci Sayısı*, *Yasaklı Öğrenci*) yer alır . Alt kısımda ise 6 ana sekme bulunur :

### Sekme 0: Yoğunluk & Doluluk Analizi + A4 PDF Faaliyet Raporu
- **Gelecek 1 Saat Operasyon Radarı:** Şu an odalarda aktif kaç grup olduğunu ve önümüzdeki 60 dakika içinde kaç yeni grubun (ve öğrencinin) kapı QR doğrulaması yapacağını canlı gösterir .
- **Faaliyet Raporu Performans Kartları:** Randevu gerçekleşme (`completionRate`), iptal (`cancellationRate`) ve `No-Show` oranlarını, ortalama grup büyüklüğünü (`avgGroupSize`) ve ortalama çalışma süresini (`avgDurationHours`) sunar .
- **Grafikler:** Sol tarafta `RoomDensityChart` , sağ tarafta **Bölüm Bazlı Kullanım Dağılımı**, altında **Çalışma Odası Tercih Sıralaması** ve en altta **7/24 Saatlik Yoğunluk Isı Haritası (Peak Hours Heatmap)** yer alır .
- **A4 PDF Yazdırma Mimarisi (`handlePrintPdfReport`):** `window.print()` tetiklendiğinde Navbar, Footer ve butonlar `@media print: { display: 'none' }` ile gizlenir; en üstte THKÜ logolu resmi rapor anteti açılır ve tüm grafik kartları `breakInside: 'avoid'` kuralıyla ortadan bölünmeden A4 sayfasına oturur .

### Sekme 1: Rezervasyon Yönetimi (Telefon Numarası Destekli)
- Öğrenci adı, e-posta, **telefon numarası (`📞`)**, öğrenci numarası, bölüm, oda kodu veya çalışma amacına göre anlık arama (`resSearch`) ve oda filtreleme (`resRoomFilter`) sunar .
- **4 Operasyon Butonu (`RESERVATION_OP`):**
  - `FORCE_CHECKIN`: Kapı QR okutamayan gruplar için görevli tarafından manuel Check-In yapar .
  - `EARLY_FINISH`: Odayı erken boşaltır (`COMPLETED`) ve kalan saatleri diğer öğrencilere açar .
  - `MARK_NO_SHOW`: Kapı QR onayı vermeyen üyelere `1/3 No-Show` uyarısı (15 puan) işler; `3/3` olanları otomatik 30 gün banlar .
  - `CANCEL`: Randevuyu iptal eder ve tüm gruba (onaylıysa müdüre de) iptal maili gönderir .

### Sekme 2: Odaları Ekle / Düzenle / Sil
- Oda anahtardan kapatıldığında (`TOGGLE_ROOM`), odaya ait **mevcut onaylı randevular iptal edilmez**; yalnızca yeni randevu alımı durdurulur .
- `editRoomDialog` modalı ile oda kodu, ismi (örn: `R103 - Hürkuş`) ve kapasitesi güncellenebilir .

### Sekme 3: Duyuru Yayınla
- Türkçe ve İngilizce başlık/içerik ile 4 farklı öncelik seviyesinde (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) duyuru yayınlama ve silme ekranıdır .

### Sekme 4: Öğrenciler, Ban & Yetkiler
- Öğrencilerin telefon numaralarını (`📞`), bölümlerini, `No-Show: X / 3` sayaçlarını ve ban durumlarını listeler .
- **Takvimli ve Kalıcı Ban Modalı (`banDialog`):** Yönetici öğrenciyi banlarken `DATE` (takvimden bitiş tarihi seçmeli + `+7`, `+14`, `+30`, `+90` gün hızlı çipleri) veya `PERMANENT` (Kalıcı / Perma Ban) modunu seçebilir ve ban sebebini yazabilir .

### Sekme 5: Dinamik Kurallar & 180 Günlük Loglar
- **`RULE_META` (7 Dinamik Kural):** `MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`, `MAX_DURATION_HOURS`, `MAX_ADVANCE_DAYS`, `DAILY_RELEASE_HOUR`, `CHECKIN_TOLERANCE_MINUTES` ve `CANCEL_LOCK_MINUTES` parametrelerini azaltıp artırarak anında günceller .
- **Eşit Boyda Hizalanmış 180 Günlük Loglar:** Sol sütunda `formatAuditLog()` ile anlamlandırılmış **Öğrenci & Sistem Logları** (`AUTO_NO_SHOW_PENALTY`, `AUTO_NO_SHOW_BANNED`, `AUTO_KIOSK_CANCELLED`, `AUTO_TIMEOUT_CANCELLED` dahil), sağ sütunda **Yönetici Müdahale Logları** `minHeight: 118` ile simetrik olarak listelenir .

##  5. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/admin/manage/route.js` (`GET` & `POST`) 
- `frontend/src/components/dashboard/RoomDensityChart.jsx` 
- `frontend/src/components/Navbar.jsx` & `Footer.jsx` 