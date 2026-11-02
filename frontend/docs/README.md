<div align="center">

#  THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi<br/>Teknik Mimari ve Modül Dokümantasyon Rehberi (50 / 50)

<p align="center">
  Bu dizin, <b>7/24 Kütüphane Grup Çalışma Odaları Rezervasyon ve Kiosk Yoklama Sistemi</b>'nin tüm kaynak kod modüllerini (<b>21 Frontend + 29 Backend = 50 Doküman</b>), SOLID servis katmanlarını, iş kurallarını ve güvenlik mekanizmalarını açıklayan bileşen düzeyinde teknik dokümantasyonu içerir.
</p>

<p align="center">
  <a href="/README.md"><img src="https://img.shields.io/badge/%F0%9F%8F%9B%EF%B8%8F_Ana_Sayfa-Root_README-0F172A?style=for-the-badge" alt="Root README" /></a>
  <a href="/docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md"><img src="https://img.shields.io/badge/%F0%9F%93%91_Sistem_Mimarisi-T%C3%BCrk%C3%A7e_(TR)-C8102E?style=for-the-badge" alt="Sistem Mimarisi TR" /></a>
  <a href="/backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_İndeksi-29_Mod%C3%BCl-1E3A8A?style=for-the-badge" alt="Backend Docs" /></a>
  <a href="/frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_İndeksi-21_Mod%C3%BCl-047857?style=for-the-badge" alt="Frontend Docs" /></a>
</p>

</div>

---

##  1. Çekirdek Mimari Prensipler

| # | Mimari Prensip | İlgili Çekirdek Modüller | Teknik Uygulama ve İş Kuralı Özeti |
| :-: | :--- | :--- | :--- |
| **1** | **7/24 Kesintisiz Hizmet & Dinamik Kurallar** | `reserve/init`, `AdminPanel.jsx`, `RulesAndLogsTab.jsx` | Kütüphane çalışma odaları (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) 00:00 – 24:00 saatleri arasında 7/24 hizmet verir. Sistemdeki 7 temel parametre (`MIN_PARTICIPANTS: 2`, `MAX_PARTICIPANTS: 8`, `MAX_DURATION_HOURS: 3`, `MAX_ADVANCE_DAYS: 1`, `DAILY_RELEASE_HOUR: 8`, `CHECKIN_TOLERANCE_MINUTES: 15`, `CANCEL_LOCK_MINUTES: 60`) veritabanından dinamik olarak yönetilir. |
| **2** | **4 Katmanlı Fiziksel Kiosk Kapı QR Güvenliği** | `kioskSecurity.js`, `kiosk/qr`, `checkin/validate`, `api.js` | Öğrencilerin odaya giriş onayı (`Check-In`) verebilmesi için: **1)** Fiziksel kapı QR parametresi (`door=thku-study-room`), **2)** Kampüs Wi-Fi (`eduroam`) doğrulaması ve Hücresel Veri / VPN engeli, **3)** Kütüphane merkezli **1000m sabit GPS yarıçapı** doğrulaması, **4)** Gizli Sekme (Incognito) korumalı **Cihaz Kilidi** (`Cookie` + `localStorage` + `WebGL GPU Donanım Parmak İzi` + `Eduroam NAT Uyumlu IP/UA Hash`) katmanlarından geçmesi zorunludur. |
| **3** | **Adil No-Show Cezası & Otomatik Oda Boşaltma** | `lifecycle.js`, `penaltyService.js`, `emailService.js` | Grup davetleri **30 dakika** içinde en az 1 davetli tarafından onaylanmazsa randevu otomatik iptal edilir. Randevu başlangıcından **±15 dakika** içinde en az 2 grup üyesi kapı QR kodunu okutmazsa randevu `NO_SHOW` olur ve oda takvimde anında diğer öğrencilere açılır. Kapıda QR okutmuş olan öğrenciye (`verifiedUsers`) **ceza yazılmaz**; yalnızca gelmeyen üyelere (`absentUsers`) `1/3 No-Show` uyarısı işlenir. `3/3` olan öğrenci otomatik olarak **30 gün banlanır**. |
| **4** | **Boşa Düşen Odayı Ara Dakikada Tutma (`Walk-In`)** | `timeUtils.js`, `reservations/route.js`, `kiosk/qr` | Normal randevuların (`createdAt <= startTotalMins`) Kiosk penceresi sabit `start ± 15 dk` (örn. `15:45 – 16:15`) aralığındadır. İlk grup gelmediği veya erken boşalttığı için ara dakikada (örn. `16:20`'de) boşa düşen bir odayı aynı saat dilimi (`16:00 – 18:00`) için sıfırdan tutan yeni gruba (`createdAt > startTotalMins`), oluşturulma anından itibaren **15 dakika (`16:20 – 16:35`)** Kiosk onay penceresi tanımlanır. |

---

##  2. Tüm Dokümanların Dizin Haritası (50 Modül)

###  A. Frontend Dokümanları (`frontend/docs/` — 20 Modül + 1 İndeks)

#### 1) Sayfa Bileşenleri (`frontend/src/pages/`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **01** | [📄 `dashboard.md`](/frontend/docs/dashboard.md) | `src/pages/Dashboard.jsx` | Öğrenci ana kontrol paneli, aktif No-Show uyarı rozeti, bekleyen grup davetleri ve duyuru merkezi |
| **02** | [📄 `AdminPanel.md`](/frontend/docs/AdminPanel.md) | `src/pages/AdminPanel.jsx` | 6 sekmeli yönetim orkestratörü, analitik veri çekimi ve A4 PDF faaliyet raporu merkezi |
| **03** | [📄 `ReserveForm.md`](/frontend/docs/ReserveForm.md) | `src/pages/ReserveForm.jsx` | 2 aşamalı tarih/saat seçimi ve kurumsal e-posta ile grup katılımcısı ekleme sihirbazı |
| **04** | [📄 `Kiosk.md`](/frontend/docs/Kiosk.md) | `src/pages/Kiosk.jsx` | A4 Kapı QR Posteri (Yetkili modu) ve canlı GPS/Wi-Fi kapı yoklama ekranı (Öğrenci modu) |
| **05** | [📄 `MyBookings.md`](/frontend/docs/MyBookings.md) | `src/pages/MyBookings.jsx` | Aktif/geçmiş randevular, odayı erken boşaltma (`EARLY_CHECKOUT`), iptal kilidi ve davet yanıtlama |
| **06** | [📄 `StudyRooms.md`](/frontend/docs/StudyRooms.md) | `src/pages/StudyRooms.jsx` | Çalışma odaları keşif listesi ve gerçek zamanlı tarih, saat aralığı, süre ve kapasite filtreleme |
| **07** | [📄 `Profile.md`](/frontend/docs/Profile.md) | `src/pages/Profile.jsx` | Microsoft Azure AD profil fotoğrafı senkronizasyonu ve doğrulamalı acil durum telefonu güncelleme |
| **08** | [📄 `rulesacceptance.md`](/frontend/docs/rulesacceptance.md) | `src/pages/RulesAcceptance.jsx` | 6 maddelik TR/EN zorunlu kullanıcı sözleşmesi onay ve salt-okunur görüntüleme ekranı |
| **09** | [📄 `login.md`](/frontend/docs/login.md) | `src/pages/Login.jsx` | Microsoft Entra ID (Azure AD) SSO ve `.env` kontrollü güvenli demo giriş kapısı |

#### 2) Alt Bileşenler, Yardımcı Modüller ve Altyapı (`frontend/src/components/`, `utils/`, `src/`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **10** | [📄 `Components-Admin.md`](/frontend/docs/Components-Admin.md) | `src/components/admin/*` | Modüler Yönetim Paneli sekmeleri (`AnalyticsTab`, `ReservationsTab`, `RoomsTab`, `AnnouncementsTab`, `UsersTab`, `RulesAndLogsTab`, `adminConstants.js`) |
| **11** | [📄 `Navbar.md`](/frontend/docs/Navbar.md) | `src/components/Navbar.jsx` | Rol duyarlı üst navigasyon çubuğu, interaktif bildirim merkezi ve TR/EN dil değiştirici |
| **12** | [📄 `Footer.md`](/frontend/docs/Footer.md) | `src/components/Footer.jsx` | Kurumsal alt bilgi, rol duyarlı hızlı bağlantılar ve geliştirici rozeti |
| **13** | [📄 `RoomDensityChart.md`](/frontend/docs/RoomDensityChart.md) | `src/components/dashboard/RoomDensityChart.jsx` | Odaların bugünkü 24 saatlik dilim üzerinden doluluk yüzdesini gösteren dikey sütun grafiği |
| **14** | [📄 `DateUtils.md`](/frontend/docs/DateUtils.md) | `src/utils/dateUtils.js` | Tarayıcı saat diliminden bağımsız merkezi Türkiye saati (`Europe/Istanbul`) ve UTC formatlama motoru |
| **15** | [📄 `FormatTime.md`](/frontend/docs/FormatTime.md) | `src/utils/formatTime.js` | Duyuru ve bildirim zamanlarını TR/EN göreceli zamana (`5 dk önce` / `5m ago`) dönüştüren yardımcı modül |
| **16** | [📄 `Api.md`](/frontend/docs/Api.md) | `src/api.js` | WebGL GPU donanım parmak izi, cihaz jetonu ve ağ bağlantı tipini (`wifi`/`cellular`) enjekte eden Axios istemcisi |
| **17** | [📄 `App.md`](/frontend/docs/App.md) | `src/App.jsx` | Ana yönlendirme (Routing) ağacı, alt alan adı koruması ve global sözleşme reddi dinleyicisi |
| **18** | [📄 `i18n.md`](/frontend/docs/i18n.md) | `src/i18n.js` | Türkçe (`tr`) ve İngilizce (`en`) tam kapsamlı uluslararasılaştırma çeviri sözlüğü |
| **19** | [📄 `Main.md`](/frontend/docs/Main.md) | `src/main.jsx` | Oturum, yönlendirici ve kurumsal tema sağlayıcı (Provider) sarmalayıcıları ve DOM giriş noktası |
| **20** | [📄 `Theme.md`](/frontend/docs/Theme.md) | `src/theme.js` | Kurumsal MUI renk paleti (`#C8102E` & `#0F172A`), tipografi hiyerarşisi ve A4 yazdırma (`@media print`) stilleri |

---

###  B. Backend Dokümanları (`backend/docs/` — 28 Modül + 1 İndeks)

#### 1) Çekirdek Kütüphaneler, Veritabanı ve Ara Katmanlar (`backend/src/lib/`, `prisma/`, `middleware`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **21** | [📄 `Lifecycle.md`](/backend/docs/Lifecycle.md) | `src/lib/lifecycle.js` | 30 saniyelik otonom zamanlayıcı, 30 dk davet zaman aşımı, 2 saat hatırlatması ve randevu durum makinesi |
| **22** | [📄 `TimeUtils.md`](/backend/docs/TimeUtils.md) | `src/lib/timeUtils.js` | Merkezi Türkiye saati (`Europe/Istanbul`), sahte-UTC dönüşümleri ve Walk-In Kiosk pencere hesaplayıcısı |
| **23** | [📄 `KioskSecurity.md`](/backend/docs/KioskSecurity.md) | `src/lib/kioskSecurity.js` | 4 katmanlı GPS (`Haversine`), Kampüs Wi-Fi (`eduroam`) ve gizli sekme korumalı WebGL cihaz kilidi motoru |
| **24** | [📄 `EmailService.md`](/backend/docs/EmailService.md) | `src/lib/emailService.js` | Kurumsal duyarlı HTML e-posta şablon motoru ve `EmailQueue` destekli güvenli SMTP gönderim servisi |
| **25** | [📄 `PenaltyService.md`](/backend/docs/PenaltyService.md) | `src/lib/penaltyService.js` | Adil No-Show ceza servisi (`1/3 -> 3/3`), otomatik 30 gün banlama ve gelecekteki randevuları iptal etme motoru |
| **26** | [📄 `Schema.Prisma.md`](/backend/docs/Schema.Prisma.md) | `prisma/schema.prisma` | 20 modelli ve 9 enum tipli ilişkisel PostgreSQL veritabanı şeması ve indeks mimarisi |
| **27** | [📄 `Seed.cjs.md`](/backend/docs/Seed.cjs.md) | `prisma/seed.cjs` | Zengin analitik ısı haritası, örnek randevu ve 7 farklı rol/ceza senaryosu üreten başlangıç veri betiği |
| **28** | [📄 `Db.md`](/backend/docs/Db.md) | `src/lib/db.js` | HMR sırasında bağlantı havuzu taşmasını önleyen Prisma Client Singleton bağlantısı |
| **29** | [📄 `Redis.md`](/backend/docs/Redis.md) | `src/lib/redis.js` | Redis istemci bağlantısı, Kiosk OTP jetonları, yoklama kümeleri ve 4 saatlik cihaz kilidi anahtar mimarisi |
| **30** | [📄 `Middleware.md`](/backend/docs/Middleware.md) | `src/middleware.js` | Yönetim paneli alt alan adını (`panel.library.thk.edu.tr`) koruyan Next.js Edge JWT güvenlik duvarı |
| **31** | [📄 `CheckRulesAcceptance.md`](/backend/docs/CheckRulesAcceptance.md) | `src/middleware/checkRulesAcceptance.js` | Kullanıcının aktif sözleşme versiyonunu onayladığını denetleyen API ara katmanı |
| **32** | [📄 `Layout-And-Page.md`](/backend/docs/Layout-And-Page.md) | `src/app/layout.js` & `page.js` | Next.js App Router kök şablon (Root Layout) ve Headless API durum sayfası dosyaları |

#### 2) RESTful API Uç Noktaları (`backend/src/app/api/**/route.js`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **33** | [📄 `Admin-Manage-and-Handlers.md`](/backend/docs/Admin-Manage-and-Handlers.md) | `app/api/admin/manage/*` | Yönetim paneli analitik (`route.js` GET) ve 8 idari operasyon işleyicisi (`handlers.js` POST) merkezi |
| **34** | [📄 `Admin-Set-role.md`](/backend/docs/Admin-Set-role.md) | `app/api/admin/set-role/route.js` | Yalnızca `SUPER_ADMIN` yetkisiyle çalışan özel kullanıcı rolü değiştirme uç noktası |
| **35** | [📄 `Auth-Nextauth.md`](/backend/docs/Auth-Nextauth.md) | `app/api/auth/[...nextauth]/route.js` | Microsoft Entra ID (Azure AD) SSO, güvenli Demo girişi ve süresi dolan banları otomatik açma (`Auto-Unban`) |
| **36** | [📄 `Kiosk-QR.md`](/backend/docs/Kiosk-QR.md) | `app/api/kiosk/qr/route.js` | 4 katmanlı Kiosk ön güvenlik denetimi, ±15 dk pencere kontrolü ve 15 dakikalık kişisel OTP üretimi |
| **37** | [📄 `Checkin-Validate.md`](/backend/docs/Checkin-Validate.md) | `app/api/checkin/validate/route.js` | Kiosk yoklama onayı, 4 saatlik Redis cihaz mühürleme ve 2. grup üyesinde odayı `CHECKED_IN` yapma |
| **38** | [📄 `reservations.md`](/backend/docs/reservations.md) | `app/api/reservations/route.js` | Rezervasyon oluşturma (`POST`), listeleme (`GET`), erken boşaltma (`PATCH`) ve iptal kilidi (`DELETE`) servisi |
| **39** | [📄 `Reservations-Active.md`](/backend/docs/Reservations-Active.md) | `app/api/reservations/active/route.js` | Öğrenci anasayfasındaki (`Dashboard.jsx`) aktif ve yaklaşan randevuları besleyen hızlı sorgu servisi |
| **40** | [📄 `Invitations.md`](/backend/docs/Invitations.md) | `app/api/invitations/route.js` | Öğrenciye gönderilen ve yanıt bekleyen (`PENDING`) grup çalışması davetlerini listeleme servisi |
| **41** | [📄 `Invitations-Respond.md`](/backend/docs/Invitations-Respond.md) | `app/api/invitations/respond/route.js` | Grup daveti kabul/red (`ACCEPT`/`REJECT`) ve alt limit sağlandığında `PENDING -> CONFIRMED` geçiş servisi |
| **42** | [📄 `rooms.md`](/backend/docs/rooms.md) | `app/api/rooms/route.js` | Aktif çalışma odalarını ve seçilen güne ait dolu saat dilimlerini (`occupiedSlots`) listeleme servisi |
| **43** | [📄 `Rooms-Availability.md`](/backend/docs/Rooms-Availability.md) | `app/api/rooms/[id]/availability/route.js` | Seçilen oda ve tarih için gerçek zamanlı dolu saat aralıklarını (`occupiedSlots`) döndüren sorgu servisi |
| **44** | [📄 `Reserve-Init.md`](/backend/docs/Reserve-Init.md) | `app/api/reserve/init/route.js` | Aktif çalışma odalarını ve 7 dinamik rezervasyon kuralını tek istekte döndüren başlangıç servisi |
| **45** | [📄 `Dashboard-Room-Density.md`](/backend/docs/Dashboard-Room-Density.md) | `app/api/dashboard/room-density/route.js` | Her çalışma odasının bugünkü 24 saatlik dilim üzerinden doluluk yüzdesini (`occupancyPercent`) hesaplayan servis |
| **46** | [📄 `Announcements.md`](/backend/docs/Announcements.md) | `app/api/announcements/route.js` | Kütüphane yönetimi tarafından yayınlanan aktif duyuruları listeleme servisi |
| **47** | [📄 `Profile.md`](/backend/docs/Profile.md) | `app/api/profile/route.js` | Kullanıcı profil bilgilerini görüntüleme (`GET`) ve `PHONE_REGEX` doğrulamalı telefon güncelleme (`PATCH`) servisi |
| **48** | [📄 `Agreements-Active.md`](/backend/docs/Agreements-Active.md) | `app/api/agreements/active/route.js` | Veritabanında yürürlükte olan (`isActive: true`) en güncel kullanıcı sözleşmesini döndüren servis |
| **49** | [📄 `User-Accept-Rules.md`](/backend/docs/User-Accept-Rules.md) | `app/api/user/accept-rules/route.js` | Kullanıcının onayladığı sözleşme versiyonunu veritabanına mühürleyen servis |
| **50** | [📄 `README.md`](/backend/docs/README.md) | `backend/docs/README.md` & `frontend/docs/README.md` | Genel sistem mimarisi prensipleri ve 50 modüllük dokümantasyon indeks rehberi |

---

<div align="center">
  <sub>© 2026 <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> • Geliştirici: <b>Bora Avcu</b></sub>
</div>

