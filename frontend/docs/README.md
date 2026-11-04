<div align="center">

# THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi<br/>Teknik Mimari ve Modül Dokümantasyon Rehberi (61 / 61)

<p align="center">
  Bu dizin, <b>7/24 Kütüphane Grup Çalışma Odaları Rezervasyon ve Kiosk Yoklama Sistemi</b>'nin tüm kaynak kod modüllerini (<b>23 Frontend Modülü + 37 Backend Modülü + 1 İndeks = 61 Doküman</b>), SOLID servis katmanlarını, iş kurallarını ve güvenlik mekanizmalarını açıklayan bileşen düzeyinde teknik dokümantasyonu içerir.
</p>

<p align="center">
  <a href="/README.md"><img src="https://img.shields.io/badge/%F0%9F%8F%9B%EF%B8%8F_Ana_Sayfa-Root_README-0F172A?style=for-the-badge" alt="Root README" /></a>
  <a href="/docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md"><img src="https://img.shields.io/badge/%F0%9F%93%91_Sistem_Mimarisi-T%C3%BCrk%C3%A7e_(TR)-C8102E?style=for-the-badge" alt="Sistem Mimarisi TR" /></a>
  <a href="/backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_%C4%B0ndeksi-38_Dosya-1E3A8A?style=for-the-badge" alt="Backend Docs" /></a>
  <a href="/frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_%C4%B0ndeksi-24_Dosya-047857?style=for-the-badge" alt="Frontend Docs" /></a>
  <a href="/deploy/README.md"><img src="https://img.shields.io/badge/%F0%9F%9A%80_Canl%C4%B1_Da%C4%9F%C4%B1t%C4%B1m-Deploy-7C3AED?style=for-the-badge" alt="Deploy Docs" /></a>
</p>

</div>

---

## 1. Çekirdek Mimari Prensipler

| # | Mimari Prensip | İlgili Çekirdek Modüller | Teknik Uygulama ve İş Kuralı Özeti |
| :-: | :--- | :--- | :--- |
| **1** | **7/24 Kesintisiz Hizmet & Dinamik Kurallar** | `reservationPolicy.js`, `reserve/init`, `AdminPanel.jsx`, `RulesAndLogsTab.jsx` | Çalışma odaları (`R101`–`R104`) 00:00 – 24:00 saatleri arasında 7/24 hizmet verir. Sistemdeki 7 temel parametre (`MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`, `MAX_DURATION_HOURS`, `MAX_ADVANCE_DAYS`, `DAILY_RELEASE_HOUR`, `CHECKIN_TOLERANCE_MINUTES`, `CANCEL_LOCK_MINUTES`) veritabanından canlı olarak yönetilir. |
| **2** | **PostgreSQL Atomik 4 Katmanlı Kiosk QR Güvenliği** | `kioskSecurity.js`, `kioskStore.js`, `kioskSql.mjs`, `kiosk/qr`, `checkin/validate`, `api.js` | Harici Redis olmadan PostgreSQL `SELECT ... FOR UPDATE` satır kilidiyle çalışır: **1)** Kapı QR parametresi (`door=thku-study-room`) ve oturum dönüş hafızası, **2)** Kampüs Wi-Fi (`eduroam`) & Anti-VPN denetimi, **3)** Opsiyonel Haversine **1000m GPS yarıçapı**, **4)** Gizli sekme (Incognito) korumalı ve kampüs NAT güvenli 4 saatlik `kiosk_device_locks` kilidi. |
| **3** | **Kurumsal `@thk.edu.tr` Personel Şifre Girişi & Güvenlik Kapıları** | `staffAccount.js`, `staffAuth.mjs`, `loginRateLimit.js`, `passwordGate.js`, `ChangePassword.jsx` | Microsoft Entra ID SSO yanında `@thk.edu.tr` personeli için `scrypt` (`N=16384`) şifre girişi, 72 saatlik geçici şifre, ilk girişte zorunlu şifre değişimi (`mustChangePassword`), `sessionVersion` oturum iptali ve PostgreSQL tabanlı 10 dakikalık brute-force koruması uygulanır. |
| **4** | **Adil No-Show Cezası, Otomatik Tamamlama & Walk-In** | `lifecycle.js`, `penaltyService.js`, `timeUtils.js` | 30 dk içinde onaylanmayan davetler iptal olur; ±15 dk içinde en az 2 üye kapı QR okutmazsa oda `NO_SHOW` olur ve QR okutmuş öğrenciye ceza yazılmaz (`3/3` olan 30 gün banlanır). Bitiş saati gelen `CONFIRMED` ve `CHECKED_IN` randevular otomatik `COMPLETED` olur; ara dakikada tutulan odalara 15 dk Walk-In penceresi verilir. |

---

## 2. Tüm Dokümanların Dizin Haritası (61 Modül)

### A. Frontend Dokümanları (`frontend/docs/` — 23 Modül + 1 İndeks = 24 Dosya)

#### 1) Sayfa Bileşenleri (`frontend/src/pages/`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **01** | [📄 `Dashboard.md`](/frontend/docs/Dashboard.md) | `src/pages/Dashboard.jsx` | Öğrenci ana kontrol paneli, aktif No-Show uyarı rozeti, bekleyen grup davetleri ve duyuru merkezi |
| **02** | [📄 `AdminPanel.md`](/frontend/docs/AdminPanel.md) | `src/pages/AdminPanel.jsx` | 6 sekmeli yönetim orkestratörü, analitik rapor merkezi ve `PURGE_TEST_DATA` test verisi temizliği |
| **03** | [📄 `ReserveForm.md`](/frontend/docs/ReserveForm.md) | `src/pages/ReserveForm.jsx` | 2 aşamalı tarih/saat seçimi ve kurumsal e-posta ile grup katılımcısı ekleme sihirbazı |
| **04** | [📄 `Kiosk.md`](/frontend/docs/Kiosk.md) | `src/pages/Kiosk.jsx` | A4 Kapı QR Posteri (Yetkili modu), kapı dönüş hafızası ve canlı kapı yoklama ekranı (Öğrenci modu) |
| **05** | [📄 `MyBookings.md`](/frontend/docs/MyBookings.md) | `src/pages/MyBookings.jsx` | Aktif/geçmiş randevular, odayı erken boşaltma (`EARLY_CHECKOUT`), iptal kilidi ve davet yanıtlama |
| **06** | [📄 `StudyRooms.md`](/frontend/docs/StudyRooms.md) | `src/pages/StudyRooms.jsx` | Çalışma odaları keşif listesi ve gerçek zamanlı tarih, saat aralığı, süre ve kapasite filtreleme |
| **07** | [📄 `Profile.md`](/frontend/docs/Profile.md) | `src/pages/Profile.jsx` | Microsoft Azure AD profil fotoğrafı senkronizasyonu ve doğrulamalı acil durum telefonu güncelleme |
| **08** | [📄 `RulesAcceptance.md`](/frontend/docs/RulesAcceptance.md) | `src/pages/RulesAcceptance.jsx` | 6 maddelik TR/EN zorunlu kullanıcı sözleşmesi onay ve salt-okunur görüntüleme ekranı |
| **09** | [📄 `Login.md`](/frontend/docs/Login.md) | `src/pages/Login.jsx` | Microsoft Entra ID SSO, Kurumsal `@thk.edu.tr` personel şifre girişi ve `.env` kontrollü demo girişi |
| **10** | [📄 `ChangePassword.md`](/frontend/docs/ChangePassword.md) | `src/pages/ChangePassword.jsx` | Kurumsal `@thk.edu.tr` personeli için ilk girişte zorunlu ve isteğe bağlı şifre güncelleme ekranı |

#### 2) Alt Bileşenler, Yardımcı Modüller ve Altyapı (`frontend/src/components/`, `utils/`, `src/`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **11** | [📄 `Components-Admin.md`](/frontend/docs/Components-Admin.md) | `src/components/admin/*` | Modüler Yönetim Paneli sekmeleri, kurumsal personel hesap oluşturma, geçici şifre sıfırlama ve aktif/pasif anahtarı |
| **12** | [📄 `Navbar.md`](/frontend/docs/Navbar.md) | `src/components/Navbar.jsx` | Rol duyarlı üst menü, kurumsal şifre değiştirme kısayolu, bildirim merkezi ve TR/EN dil değiştirici |
| **13** | [📄 `Footer.md`](/frontend/docs/Footer.md) | `src/components/Footer.jsx` | Kurumsal alt bilgi, rol duyarlı hızlı bağlantılar ve geliştirici rozeti |
| **14** | [📄 `PasswordField.md`](/frontend/docs/PasswordField.md) | `src/components/PasswordField.jsx` | Göster/Gizle ikonlu erişilebilir Material-UI şifre giriş bileşeni |
| **15** | [📄 `RoomDensityChart.md`](/frontend/docs/RoomDensityChart.md) | `src/components/dashboard/RoomDensityChart.jsx` | Odaların bugünkü 24 saatlik dilim üzerinden doluluk yüzdesini gösteren dikey sütun grafiği |
| **16** | [📄 `DateUtils.md`](/frontend/docs/DateUtils.md) | `src/utils/dateUtils.js` | Merkezi Türkiye saati (`Europe/Istanbul`), UTC formatlama ve `isReservationEnded` bitiş kontrol motoru |
| **17** | [📄 `FormatTime.md`](/frontend/docs/FormatTime.md) | `src/utils/formatTime.js` | Duyuru ve bildirim zamanlarını TR/EN göreceli zamana (`5 dk önce` / `5m ago`) dönüştüren yardımcı modül |
| **18** | [📄 `RuntimePaths.md`](/frontend/docs/RuntimePaths.md) | `src/runtimePaths.js` | `/randevu` alt dizin dağıtımı için `APP_BASE`, `API_BASE`, `AUTH_BASE` ve URL normalizasyon yardımcıları |
| **19** | [📄 `Api.md`](/frontend/docs/Api.md) | `src/api.js` | WebGL GPU donanım parmak izi, cihaz jetonu ve ağ bağlantı tipini (`wifi`/`cellular`) enjekte eden Axios istemcisi |
| **20** | [📄 `App.md`](/frontend/docs/App.md) | `src/App.jsx` | Ana yönlendirme ağacı, `RequirePasswordChanged` zorunlu şifre kapısı ve sözleşme reddi dinleyicisi |
| **21** | [📄 `i18n.md`](/frontend/docs/i18n.md) | `src/i18n.js` | Türkçe (`tr`) ve İngilizce (`en`) tam kapsamlı uluslararasılaştırma çeviri sözlüğü |
| **22** | [📄 `Main.md`](/frontend/docs/Main.md) | `src/main.jsx` | `AUTH_BASE` oturum, `APP_BASE` yönlendirici ve kurumsal tema sağlayıcı sarmalayıcıları |
| **23** | [📄 `Theme.md`](/frontend/docs/Theme.md) | `src/theme.js` | Kurumsal MUI renk paleti (`#C8102E` & `#0F172A`), tipografi hiyerarşisi ve A4 yazdırma (`@media print`) stilleri |

---

### B. Backend Dokümanları (`backend/docs/` — 37 Modül + 1 İndeks = 38 Dosya)

#### 1) Çekirdek Kütüphaneler, Veritabanı, Ara Katmanlar ve Testler (`backend/src/lib/`, `prisma/`, `middleware`, `test/`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **24** | [📄 `Lifecycle.md`](/backend/docs/Lifecycle.md) | `src/lib/lifecycle.js` | 30 saniyelik otonom zamanlayıcı, 30 dk davet zaman aşımı, `CONFIRMED`/`CHECKED_IN -> COMPLETED` ve No-Show motoru |
| **25** | [📄 `TimeUtils.md`](/backend/docs/TimeUtils.md) | `src/lib/timeUtils.js` | Merkezi Türkiye saati (`Europe/Istanbul`), `fmtTimeRangeUTC` ve Walk-In Kiosk pencere hesaplayıcısı |
| **26** | [📄 `ReservationPolicy.md`](/backend/docs/ReservationPolicy.md) | `src/lib/reservationPolicy.js` | 7 dinamik rezervasyon kuralı, günlük 1 randevu kotası, gece/sabah kuralı ve banlı öğrenci randevu politikası |
| **27** | [📄 `KioskSecurity.md`](/backend/docs/KioskSecurity.md) | `src/lib/kioskSecurity.js` | 4 katmanlı GPS (`Haversine`), Kampüs Wi-Fi (`eduroam`) ve NAT güvenli WebGL/IP/UA cihaz kilidi motoru |
| **28** | [📄 `KioskStore.md`](/backend/docs/KioskStore.md) | `src/lib/kioskStore.js` & `kioskSql.mjs` | PostgreSQL `SELECT ... FOR UPDATE` kilitli Kiosk OTP (`kiosk_qr_tokens`), yoklama ve 4 saatlik cihaz kilidi deposu |
| **29** | [📄 `StaffAccount.md`](/backend/docs/StaffAccount.md) | `src/lib/staffAccount.js`, `staffAuth*.mjs`, `staffMail.js` | `@thk.edu.tr` kurumsal personel hesabı, `scrypt` şifreleme, 72 saatlik geçici şifre, `sessionVersion` ve SMTP bildirim |
| **30** | [📄 `LoginRateLimit.md`](/backend/docs/LoginRateLimit.md) | `src/lib/loginRateLimit.js` | PostgreSQL `login_rate_limits` üzerinde e-posta ve IP bazlı atomik 10 dakikalık brute-force koruması |
| **31** | [📄 `PasswordGate.md`](/backend/docs/PasswordGate.md) | `src/lib/passwordGate.js` | `assertActiveSession`, `checkMustChangePassword` API güvenlik kapısı ve `noStoreJson` önbellek engeli |
| **32** | [📄 `PublicPaths.md`](/backend/docs/PublicPaths.md) | `src/lib/publicPaths.js` | `/randevu` alt dizin dağıtımı için genel URL üretici (`getPublicAppBaseUrl`, `publicAppUrl`) |
| **33** | [📄 `TestData.md`](/backend/docs/TestData.md) | `src/lib/testData.js` | `@demo.local` test kullanıcıları ve ilişkili kayıtların transaction içinde güvenli temizliği (`PURGE_TEST_DATA`) |
| **34** | [📄 `EmailService.md`](/backend/docs/EmailService.md) | `src/lib/emailService.js` | XSS korumalı kurumsal duyarlı HTML e-posta şablon motoru ve `EmailQueue` destekli SMTP gönderim servisi |
| **35** | [📄 `PenaltyService.md`](/backend/docs/PenaltyService.md) | `src/lib/penaltyService.js` | Adil No-Show ceza servisi (`1/3 -> 3/3`), otomatik 30 gün banlama ve gelecekteki randevuları iptal etme motoru |
| **36** | [📄 `Schema.Prisma.md`](/backend/docs/Schema.Prisma.md) | `prisma/schema.prisma` | 24 modelli ilişkisel PostgreSQL veritabanı şeması (Kiosk ve Kurumsal Şifre tabloları dahil) |
| **37** | [📄 `Seed.cjs.md`](/backend/docs/Seed.cjs.md) | `prisma/seed.cjs` | Zengin analitik ısı haritası, örnek randevu ve farklı rol/ceza senaryoları üreten başlangıç veri betiği |
| **38** | [📄 `Db.md`](/backend/docs/Db.md) | `src/lib/db.js` | Model ve `DATABASE_URL` değişim duyarlı Prisma Client Singleton bağlantısı |
| **39** | [📄 `Middleware.md`](/backend/docs/Middleware.md) | `src/middleware.js` | Yönetim paneli alt alan adını koruyan Next.js Edge JWT güvenlik duvarı |
| **40** | [📄 `CheckRulesAcceptance.md`](/backend/docs/CheckRulesAcceptance.md) | `src/middleware/checkRulesAcceptance.js` | Aktif oturum, zorunlu şifre değişimi ve aktif sözleşme versiyonunu denetleyen API ara katmanı |
| **41** | [📄 `Layout-And-Page.md`](/backend/docs/Layout-And-Page.md) | `src/app/layout.js` & `page.js` | Next.js App Router kök şablon (Root Layout) ve Headless API durum sayfası dosyaları |
| **42** | [📄 `Tests.md`](/backend/docs/Tests.md) | `test/kiosk-atomicity.mjs` & `staff-account.test.mjs` | PostgreSQL Kiosk eşzamanlılık/atomiklik ve kurumsal personel şifre güvenliği otomatik test paketleri (20 test) |

#### 2) RESTful API Uç Noktaları (`backend/src/app/api/**/route.js`)

| # | Doküman Dosyası | Kaynak Kod Yolu | Mimari Rol ve İş Mantığı Özeti |
| :-: | :--- | :--- | :--- |
| **43** | [📄 `Account-Password.md`](/backend/docs/Account-Password.md) | `app/api/account/password/route.js` | Kurumsal `@thk.edu.tr` personeli için zorunlu/isteğe bağlı şifre güncelleme ve `sessionVersion` yenileme uç noktası |
| **44** | [📄 `Admin-Manage-and-Handlers.md`](/backend/docs/Admin-Manage-and-Handlers.md) | `app/api/admin/manage/*` | Yönetim paneli analitik (`GET`) ve kurumsal hesap, geçici şifre, moderasyon, oda, kural ve temizlik (`POST`) merkezi |
| **45** | [📄 `Admin-Set-role.md`](/backend/docs/Admin-Set-role.md) | `app/api/admin/set-role/route.js` | Yalnızca `SUPER_ADMIN` yetkisiyle çalışan ve `sessionVersion` artıran özel kullanıcı rolü değiştirme uç noktası |
| **46** | [📄 `Auth-Nextauth.md`](/backend/docs/Auth-Nextauth.md) | `app/api/auth/[...nextauth]/route.js` | Azure AD SSO, `@thk.edu.tr` personel şifre girişi, güvenli Demo girişi, oturum versiyon kontrolü ve `Auto-Unban` |
| **47** | [📄 `Kiosk-QR.md`](/backend/docs/Kiosk-QR.md) | `app/api/kiosk/qr/route.js` | 4 katmanlı Kiosk ön güvenlik denetimi, görevli A4 poster modu ve PostgreSQL üzerinde 10 dakikalık kişisel OTP üretimi |
| **48** | [📄 `Checkin-Validate.md`](/backend/docs/Checkin-Validate.md) | `app/api/checkin/validate/route.js` | Atomik Kiosk yoklama onayı (`FOR UPDATE`), 4 saatlik PostgreSQL cihaz mühürleme ve 2. üyede odayı `CHECKED_IN` yapma |
| **49** | [📄 `Reservations.md`](/backend/docs/Reservations.md) | `app/api/reservations/route.js` | Rezervasyon oluşturma (`POST` Serializable Tx), listeleme (`GET`), erken boşaltma (`PATCH`) ve iptal kilidi (`DELETE`) |
| **50** | [📄 `Reservations-Active.md`](/backend/docs/Reservations-Active.md) | `app/api/reservations/active/route.js` | Öğrenci anasayfasındaki aktif/yaklaşan randevuları ve `kioskAttendances` yoklama sayısını besleyen sorgu servisi |
| **51** | [📄 `Invitations.md`](/backend/docs/Invitations.md) | `app/api/invitations/route.js` | Öğrenciye gönderilen ve yanıt bekleyen (`PENDING`) grup çalışması davetlerini listeleme servisi |
| **52** | [📄 `Invitations-Respond.md`](/backend/docs/Invitations-Respond.md) | `app/api/invitations/respond/route.js` | Grup daveti kabul/red (`ACCEPT`/`REJECT`) ve alt limit sağlandığında `PENDING -> CONFIRMED` geçiş servisi |
| **53** | [📄 `rooms.md`](/backend/docs/rooms.md) | `app/api/rooms/route.js` | Aktif çalışma odalarını ve seçilen güne ait dolu saat dilimlerini (`occupiedSlots`) listeleme servisi |
| **54** | [📄 `Rooms-Availability.md`](/backend/docs/Rooms-Availability.md) | `app/api/rooms/[id]/availability/route.js` | Seçilen oda ve tarih için gerçek zamanlı dolu saat aralıklarını (`occupiedSlots`) döndüren sorgu servisi |
| **55** | [📄 `Reserve-Init.md`](/backend/docs/Reserve-Init.md) | `app/api/reserve/init/route.js` | Aktif çalışma odalarını ve 7 dinamik rezervasyon kuralını tek istekte döndüren başlangıç servisi |
| **56** | [📄 `Dashboard-Room-Density.md`](/backend/docs/Dashboard-Room-Density.md) | `app/api/dashboard/room-density/route.js` | Her çalışma odasının bugünkü 24 saatlik dilim üzerinden doluluk yüzdesini (`occupancyPercent`) hesaplayan servis |
| **57** | [📄 `Announcements.md`](/backend/docs/Announcements.md) | `app/api/announcements/route.js` | Kütüphane yönetimi tarafından yayınlanan aktif duyuruları listeleme servisi |
| **58** | [📄 `Profile.md`](/backend/docs/Profile.md) | `app/api/profile/route.js` | Kullanıcı profil bilgilerini görüntüleme (`GET`) ve `PHONE_REGEX` doğrulamalı telefon güncelleme (`PATCH`) servisi |
| **59** | [📄 `Agreements-Active.md`](/backend/docs/Agreements-Active.md) | `app/api/agreements/active/route.js` | Veritabanında yürürlükte olan (`isActive: true`) en güncel kullanıcı sözleşmesini döndüren servis |
| **60** | [📄 `User-Accept-Rules.md`](/backend/docs/User-Accept-Rules.md) | `app/api/user/accept-rules/route.js` | Kullanıcının onayladığı sözleşme versiyonunu veritabanına mühürleyen servis |
| **61** | [📄 `README.md`](/backend/docs/README.md) | `backend/docs/README.md` & `frontend/docs/README.md` | Genel sistem mimarisi prensipleri ve 61 modüllük dokümantasyon indeks rehberi (+ [🚀 `deploy/README.md`](/deploy/README.md)) |

---

<div align="center">
  <sub>© 2026 <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> • Geliştirici: <b>Bora Avcu</b></sub>
</div>
