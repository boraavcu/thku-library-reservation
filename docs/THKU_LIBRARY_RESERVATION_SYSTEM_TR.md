<div align="center">

#  THK Üniversitesi 7/24 Kütüphane Grup Çalışma Odaları<br/>Rezervasyon ve Kiosk Yoklama Sistemi

### Kurumsal Sistem Mimarisi, Güvenlik Standartları ve Mühendislik Dokümantasyonu (v4.0 SOLID Production)

<p align="center">
  <a href="/README.md"><img src="https://img.shields.io/badge/%F0%9F%8F%9B%EF%B8%8F_Ana_Sayfa-Root_README-0F172A?style=for-the-badge" alt="Root README" /></a>
  <a href="/docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md"><img src="https://img.shields.io/badge/%F0%9F%8C%90_Switch_Language-English_(EN)-C8102E?style=for-the-badge" alt="English Version" /></a>
  <a href="/backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_Dok%C3%BCmanlar%C4%B1-29_Mod%C3%BCl-1E3A8A?style=for-the-badge" alt="Backend Docs" /></a>
  <a href="/frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_Dok%C3%BCmanlar%C4%B1-21_Mod%C3%BCl-047857?style=for-the-badge" alt="Frontend Docs" /></a>
</p>

</div>

---

##  1. Proje Özeti ve Mimari Vizyon (Executive Overview)

Bu proje, **Türk Hava Kurumu Üniversitesi (THKÜ)** öğrencileri, akademisyenleri ve kütüphane yönetimi için kurumsal standartlarda ve **SOLID** yazılım mimarisi prensipleriyle geliştirilmiş, **7/24 kesintisiz hizmet veren tam otonom bir Grup Çalışma Odaları Rezervasyon, Fiziksel Kiosk QR Yoklama ve Analitik Yönetim Sistemidir**.

| Çekirdek Yetenek | Mühendislik Çözümü ve Operasyonel Katkısı |
| :--- | :--- |
| ** Microsoft Entra ID (Azure AD) SSO & Rol İzolasyonu** | Kurumsal tekil oturum açma, otomatik ban süresi denetimi (`Auto-Unban`) ve alt alan adı (`Subdomain`) düzeyinde Edge JWT rol izolasyonu. |
| ** 4 Katmanlı Fiziksel Kiosk & WebGL Donanım Kilidi** | Kapı QR parametresi, Kampüs Wi-Fi (`eduroam`) & Anti-VPN denetimi, Haversine GPS yarıçapı ve gizli sekme (Incognito) korumalı WebGL GPU donanım parmak izi (`kioskSecurity.js`). |
| ** Otonom Yaşam Döngüsü & Adil No-Show Motoru** | Her 30 saniyede bir çalışan zamanlayıcı (`lifecycle.js`), kapıda QR okutan öğrenciyi koruyan adil ceza algoritması ve 3/3 ihlalde 30 gün otomatik ban (`penaltyService.js`). |
| ** Dinamik "Walk-In" Zaman Penceresi (`timeUtils.js`)** | Gelmeyen veya erken boşaltılan odaları ara dakikalarda saniyesinde kullanıma açan ve yeni gruba özel 15 dakikalık Kiosk onay penceresi tanımlayan algoritma. |
| ** Olay Güdümlü Kurumsal HTML E-Posta Servisi** | Arayüzü bloklamayan (Zero-Lag), `EmailQueue` veritabanı kuyruklu ve duyarlı (responsive) kurumsal HTML şablonlu bildirim motoru (`emailService.js`). |
| ** 6 Sekmeli Yönetim, Isı Haritası & A4 PDF Raporlama** | 7/24 yoğunluk ısı haritası, bölüm/oda analizleri, tek tıkla A4 PDF faaliyet raporu, 7 dinamik kural motoru ve 180 günlük denetim logları (`AdminPanel.jsx` & `handlers.js`). |

---

##  2. Teknoloji Yığını ve Altyapı Mimarisi (Tech Stack)

Proje; yüksek erişilebilirlik, sıfır yarış durumu (race-condition) ve hızlı yanıt süreleri için ayrıştırılmış (decoupled) modern bir Full-Stack JavaScript mimarisi üzerine inşa edilmiştir:

| Katman | Teknoloji / Kütüphane | Mimari Rolü ve Kullanım Amacı |
| :--- | :--- | :--- |
| **Frontend (İstemci)** | React 19 (Vite 7), React Router v7 | Bileşen tabanlı tek sayfa uygulaması (SPA) ve istemci yönlendirme ağacı |
| **UI & Tasarım Sistemi** | Material-UI (`@mui/material` v7), `theme.js` | Kurumsal renk paleti (`#C8102E` & `#0F172A`), tipografi ve `@media print` A4 rapor uyumluluğu |
| **Çoklu Dil (i18n)** | `i18next` & `react-i18next` | Tüm arayüz, sözleşme, hata mesajları ve bildirimlerde **%100 Türkçe (`TR`) ve İngilizce (`EN`)** desteği |
| **Backend (API & Edge)** | Next.js 16 (App Router), Edge Middleware | RESTful API uç noktaları (`/api/*`), arka plan zamanlayıcısı ve JWT rol güvenlik duvarı |
| **Kimlik Doğrulama** | `next-auth` (v4) — Azure AD Provider | Microsoft Entra ID OAuth 2.0 / OpenID Connect SSO + `.env` kontrollü güvenli Demo Modu |
| **İlişkisel Veritabanı** | PostgreSQL 16 & Prisma ORM (`db.js`) | 20 modelli ilişkisel veri şeması ve HMR bağlantı havuzu taşmasını önleyen *Singleton* deseni |
| **Önbellek & Durum** | Redis (`ioredis` — `redis.js`) | 15 dakikalık tek kullanımlık Kiosk OTP jetonları, canlı grup yoklama kümeleri ve 4 saatlik cihaz kilitleri |
| **E-Posta Motoru** | `nodemailer` (`emailService.js`) | Kurumsal SMTP/TLS entegrasyonu, `EmailQueue` hata toleranslı kuyruk ve HTML şablon motoru |

---

##  3. NextAuth + Microsoft Azure AD (Entra ID) Tam Akış ve Rol Mimarisi

### 3.1. Amaç ve Alan Adı (Domain) Ayrımı
Sistem, tek bir Microsoft Azure AD kurumsal giriş kapısı üzerinden hem öğrencileri hem de kütüphane ve bilgi işlem yetkililerini doğrulamak ve yetkilerine göre izole edilmiş panellere yönlendirmek amacıyla tasarlanmıştır:

- **`<OGRENCI_PORTALI_DOMAIN>`** *(Canlı ortamda yapılandırılır)* → **Öğrenci Çalışma Odası Portalı** (`STUDENT`)
- **`<YONETIM_PANELI_SUBDOMAIN>`** *(Canlı ortamda yapılandırılır)* → **Kütüphane Yönetim & Analiz Merkezi** (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`)

### 3.2. Detaylı OAuth 2.0 / OpenID Connect Akış Adımları
1. **Adım 1 — Kullanıcı Giriş Talebi:** Kullanıcı `Login.jsx` ekranında *"Microsoft ile Giriş Yap"* butonuna tıklar (`Frontend → /api/auth/signin/azure-ad`).
2. **Adım 2 — NextAuth Provider Başlatma:** Backend tarafında NextAuth; `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_URL` ve `NEXTAUTH_SECRET` parametreleriyle OAuth akışını başlatır.
3. **Adım 3 — Azure AD’ye Yönlendirme:** Kullanıcı Microsoft Entra ID oturum açma sayfasına yönlendirilir.
4. **Adım 4 — Kurumsal Kimlik Doğrulama:** Azure AD kullanıcı adını, parolayı ve kurumsal MFA süreçlerini doğrular; yalnızca kuruma ait öğrenci ve personel hesaplarına izin verilir.
5. **Adım 5 — Callback İşlemi:** Doğrulama sonrası kullanıcı `/api/auth/callback/azure-ad` uç noktasına döndürülür; authorization code ile access/id token değişimi yapılır.
6. **Adım 6 — Session / JWT Oluşturma:** NextAuth kullanıcı için `NEXTAUTH_SECRET` ile kriptografik olarak imzalanmış JWT oturumu üretir.
7. **Adım 7 — Kullanıcı Bilgisinin İşlenmesi ve Otonom Denetim (`auth/[...nextauth]/route.js`):**
   - Kullanıcı veritabanında yoksa `STUDENT` rolüyle otomatik oluşturulur; varsa Microsoft profil fotoğrafı (`avatarUrl`) senkronize edilir (mevcut yetkili rolleri korunur, ezilmez).
   - **Otomatik Ban Açma (`Auto-Unban`):** Kullanıcının `isBanned` durumu `true` ise ancak `bannedUntil` tarihi dolmuşsa, sistem giriş anında kullanıcının banını ve ceza puanlarını otomatik sıfırlar, aktif `PenaltyHistory` kayıtlarını pasife çeker ve `AuditLog` tablosuna `USER_AUTO_UNBANNED` kaydı düşer.
   - Kullanıcının güncel `noShowCount` (aktif uyarı sayısı), `isBanned`, `bannedUntil`, `banReason` ve `acceptedAgreementVersion` bilgileri doğrudan `session.user` nesnesine gömülür.
8. **Adım 8 — Yetkilendirme, Sözleşme ve Yönlendirme:**
   - Kullanıcı aktif sözleşmeyi (`SystemAgreement`) henüz onaylamamışsa zorunlu olarak `/rules` (`RulesAcceptance.jsx`) sayfasına yönlendirilir.
   - `LIBRARIAN`, `ADMIN` ve `SUPER_ADMIN` doğrudan `/admin` paneline; `STUDENT` ise `/dashboard` ekranına yönlendirilir.

### 3.3. Mantıksal Akış Diyagramı

```text
+-------------------------------------------------------------------------+
|                  [ Kullanıcı Tarayıcısı (Login.jsx) ]                   |
+-------------------------------------------------------------------------+
                                     |
                        "Microsoft ile Giriş Yap"
                                     |
                                     v
+-------------------------------------------------------------------------+
|              [ Backend: /api/auth/signin/azure-ad ]                     |
|         (NextAuth Azure AD Provider & OAuth 2.0 Başlatma)               |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|            [ Microsoft Entra ID (Azure AD) Kurumsal SSO ]               |
|            (Kurumsal Hesap Doğrulama + MFA + Token Üretimi)             |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|             [ Backend: /api/auth/callback/azure-ad ]                    |
|        (JWT İmzalama & Oturum Zenginleştirme - NEXTAUTH_SECRET)         |
+-------------------------------------------------------------------------+
                   |                                   |
                   v                                   v
+------------------------------------+   +--------------------------------+
|       [ Prisma / PostgreSQL ]      |   |   [ Next.js Edge Middleware ]  |
| - Kullanıcı Upsert & Avatar Sync   |   | - Yönetim Alt Alan Adı Duvarı  |
| - Auto-Unban (Süresi Dolan Banlar) |   | - Rol & Yetki İzolasyonu       |
+------------------------------------+   +--------------------------------+
                   |                                   |
                   +-----------------+-----------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|         [ Aktif Sözleşme (SystemAgreement) & Rol Yönlendirici ]         |
+-------------------------------------------------------------------------+
                   |                                   |
        (STUDENT Rolü)                 (LIBRARIAN / ADMIN / SUPER_ADMIN)
                   v                                   v
      [ Öğrenci: /dashboard ]               [ Yetkili: /admin & /kiosk ]
```

### 3.4. Olası Kimlik Doğrulama Hata Senaryoları ve Çözümleri

| Hata Kodu | Karşılaşılan Durum | Teknik Nedeni ve Çözümü |
| :--- | :--- | :--- |
| **`AADSTS90112`** | *Application identifier is expected to be a GUID* | `.env` içindeki `AZURE_AD_CLIENT_ID` yanlış girilmiş veya şablon (placeholder) olarak bırakılmıştır. |
| **`NO_SECRET`** | NextAuth başlatma hatası | `NEXTAUTH_SECRET` ortam değişkeni tanımlanmamıştır (`openssl rand -base64 32` ile üretilmelidir). |
| **`OAuthSignin`** | Giriş sayfasına geri yönlendirme | Azure Portal'daki Redirect URI ile backend `/api/auth/callback/azure-ad` adresi uyuşmuyordur veya Client Secret süresi (`expire`) dolmuştur. |

---

##  4. Kurumsal Güvenlik ve Secret Yönetim Mimarisi (Production & Key Vault Standartları)

### 4.1. Amaç ve Ortam Ayrımı
Geliştirme ortamında `.env` dosyasında tutulan hassas yapılandırma bilgilerinin (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `SMTP_PASS`, `LIBRARY_LAT`, `LIBRARY_LNG`, `CAMPUS_IP_PREFIX`), Production (Canlı) ortamda kaynak koddan tamamen ayrıştırılarak güvenli ortam değişkenleri veya **Azure Key Vault** üzerinde merkezi olarak yönetilmesi hedeflenmiştir.

### 4.2. Önerilen Key Vault Anahtar Standartları

| Key Vault Anahtar Adı | Eşleştiği Ortam Değişkeni | Açıklama |
| :--- | :--- | :--- |
| `library-reservation-azure-client-id` | `AZURE_AD_CLIENT_ID` | Azure AD Uygulama (Client) Kimliği |
| `library-reservation-azure-client-secret` | `AZURE_AD_CLIENT_SECRET` | Azure AD Uygulama Gizli Anahtarı |
| `library-reservation-azure-tenant-id` | `AZURE_AD_TENANT_ID` | Kurumsal Dizin (Tenant) Kimliği |
| `library-reservation-nextauth-secret` | `NEXTAUTH_SECRET` | 256-bit JWT İmzalama Gizli Anahtarı |
| `library-reservation-database-url` | `DATABASE_URL` | PostgreSQL Bağlantı Dizgesi |
| `library-reservation-smtp-pass` | `SMTP_PASS` | Kurumsal E-Posta Sunucu Parolası |

### 4.3. Periyodik Secret Rotation (Şifre Yenileme) Prosedürü
Azure AD Client Secret değerleri belirli bir süre sonunda sona erecek (`expire`) şekilde üretilir. Süre dolmadan önce:
1. `Azure Portal → App Registrations → Certificates & Secrets` üzerinden yeni Client Secret üretilir.
2. Yeni değer üretim ortamı değişkenlerine veya Key Vault'a tanımlanır.
3. Backend servisi yeniden başlatılır ve eski secret devre dışı bırakılır.
4. `.env` dosyaları hiçbir koşulda Git versiyon kontrolüne (`GitHub`) dahil edilmez.

---

##  5. Çekirdek Mühendislik Modülleri ve Sistem İnovasyonları (SOLID)

Sistemin fiziksel dünyada suistimal edilemeyen, kendi kendini yöneten (self-healing) kurumsal bir otomasyona dönüşmesi için iş mantığı **SOLID** prensipleriyle izole edilmiş çekirdek modüllere ayrılmıştır:

### 5.1. 4 Katmanlı Fiziksel Kiosk Kapı QR ve "Anti-Incognito" Donanım Kilidi (`kioskSecurity.js`, `kiosk/qr`, `checkin/validate`, `api.js`)
Öğrencilerin kütüphaneye gelmeden uzaktan sahte yoklama vermesini veya kütüphaneye gelen tek bir öğrencinin kendi telefonundan (gizli sekme açarak) gelmeyen arkadaşlarının yerine QR onaylamasını engellemek için **4 aşamalı savunma hattı** uygulanır:
1. **Fiziksel Kapı QR Zorunluluğu:** Doğrudan menüden `/kiosk` adresine girilmesi engellenmiştir; yalnızca oda kapılarındaki A4 posterde yer alan `?door=thku-study-room` imzalı parametresiyle erişilebilir.
2. **Kampüs Wi-Fi (`eduroam`), Mobil Veri ve Anti-VPN Denetimi (`validateNetworkSecurity`):** İstemcinin `navigator.connection` ağ tipi (`x-network-type: cellular` engeli), `.env` üzerinde tanımlanan kurumsal VPN IP bloğu (`CAMPUS_VPN_PREFIX` engeli) ve kampüs Wi-Fi IP blokları (`CAMPUS_IP_PREFIX`) gerçek zamanlı denetlenir.
3. **Haversine GPS Yarıçapı (`calculateDistanceMeters`):** Tarayıcıdan alınan yüksek doğruluklu GPS koordinatları ile `.env` üzerinde tanımlanan kütüphane merkez koordinatları (`LIBRARY_LAT`, `LIBRARY_LNG`) arasındaki kuş uçuşu mesafe Haversine formülüyle hesaplanır; izin verilen yarıçap (`LIBRARY_RADIUS_METERS`, varsayılan 1000 metre) dışındaki cihazlar reddedilir.
4. **Gizli Sekme (Incognito) Korumalı WebGL Donanım Parmak İzi ve Eduroam NAT Uyumlu Cihaz Kilidi (`validateAndLockDevice`):**
   - Öğrenci gizli sekme açıp çerezleri ve `localStorage`'ı sıfırlasa dahi, `api.js` cihazın **WebGL Ekran Kartı (GPU) Renderer modelini**, ekran çözünürlüğünü, renk derinliğini, CPU çekirdek sayısını ve saat dilimini **32-bit FNV-1a Hash** algoritmasıyla birleştirerek benzersiz bir donanım imzası (`x-device-fingerprint`) üretir.
   - Bir telefondan A öğrencisi Check-In yaptığı saniye; o cihazın `deviceToken` kimliği (`kiosk:devlock`), `WebGL GPU` donanım imzası (`kiosk:hwlock`) ve Eduroam ortak NAT IP'sinde farklı cihazların birbirini bloklamaması için donanım kimliğiyle tuzlanmış `IP+UserAgent` özeti (`kiosk:iplock`) Redis'te 4 saat boyunca (`TTL: 14400 sn`) sadece A öğrencisine kilitlenir. Aynı telefondan B öğrencisi adına giriş yapılıp onay verilmeye çalışıldığında sistem bunu anında yakalar ve reddeder.

### 5.2. Otonom Yaşam Döngüsü Motoru (`lifecycle.js`), Adil Ceza Servisi (`penaltyService.js`) ve "Walk-In" Zaman Motoru (`timeUtils.js`)
Sistemde hiçbir görevlinin manuel takibine gerek bırakmayan, her 30 saniyede bir çalışan otonom bir arka plan motoru (`runReservationLifecycleChecks`) yer alır:
- **Gece Yarısı (`00:00`) Sınır Koruması:** Türkiye saatiyle gece yarısını geçen (`23:00 – 01:00` gibi) 7/24 randevuların kesintisiz denetlenebilmesi için hem dünün (`yesterdayDateObj`) hem de bugünün (`todayDateObj`) aktif kayıtları birlikte taranır.
- **30 Dakika Grup Davet Süre Aşımı:** Oluşturulmasının üzerinden 30 dakika geçtiği halde en az 1 davetli tarafından kabul edilmeyen `PENDING` randevular otomatik iptal edilir (`AUTO_CANCEL_INVITE_TIMEOUT`) ve oda takvimde boşa çıkarılır.
- **En Az 2 Kişi Kapı QR Kuralı:** Kapıdaki QR kodu sadece 1. kişi okuttuğunda oda henüz `CHECKED_IN` olmaz; en az `MIN_PARTICIPANTS` (2 kişi) kendi mobil cihazından okuttuğunda oda açılır.
- **Adil No-Show Cezası (`verifiedUsers` vs `absentUsers` — `penaltyService.js`):** Randevu başlangıcından `+15 dakika` (`CHECKIN_TOLERANCE_MINUTES`) geçtiği halde yeterli kişi QR okutmadıysa randevu `NO_SHOW` olarak iptal edilir ve oda anında diğer öğrencilere açılır. **Kritik Adalet Kuralı:** Grupta kütüphaneye gelip kendi QR kodunu okutmuş olan öğrenci varsa (`verifiedUsers`), arkadaşları gelmediği için mağdur edilmez ve **ona kesinlikle ceza puanı yazılmaz**; yalnızca QR okutmayan üyelere (`absentUsers`) `1/3 No-Show` uyarısı (`15 puan`) işlenir.
- **3/3 Otomatik Ban Mekanizması:** Dönem içinde 3. kez No-Show yapan (`45 puan`) öğrenci sistem tarafından otomatik olarak **30 gün süreyle yasaklanır** ve hem bugünün ilerleyen saatlerindeki hem de gelecekteki aktif randevuları (`reservationDate >= todayDate`) iptal edilerek odalar boşa çıkarılır.
- **Normal Randevu vs. Ara Dakikada Boşa Düşen Oda (`getReservationKioskWindow` — `timeUtils.js`):**
  - Saat `16:00`'dan önce alınan normal randevuların (`createdAt <= startTotalMins`) Kiosk onay penceresi kesin olarak **`15:45 – 16:15`** aralığına sabitlenmiştir; davetin geç kabul edilmesi (`updatedAt`) bu süreyi asla uzatmaz.
  - Ancak `16:15`'te ilk grup gelmediği için `16:16`'da oda `NO_SHOW` olup boşa düştüğünde (veya erken boşaltıldığında), saat `16:20`'de kütüphaneye gelen yeni bir grup `17:00`'ı beklemek zorunda kalmadan doğrudan `16:00 – 18:00` dilimini rezerve edebilir (`ReserveForm.jsx`). Sistem bu yeni randevunun `16:00`'dan sonra (`createdAt > startTotalMins`) sıfırdan açıldığını algılar ve yeni gruba odaya girerken hemen okutabilmeleri için **`[createdAt, createdAt + 15 dk]` (`16:20 – 16:35`)** Kiosk penceresi tanımlar.

### 5.3. Olay Güdümlü (Event-Driven) Asenkron Kurumsal HTML E-Posta Motoru (`emailService.js`)
- **Sıfır Arayüz Beklemesi (Zero-Lag):** Davet kabulü ve rezervasyon işlemlerinde kullanıcı arayüzünün SMTP yanıtını bekleyip donmaması için tüm e-posta tetiklemeleri arka planda asenkron çalıştırılır ve `EmailQueue` tablosunda takip edilir.
- **Kurumsal HTML Şablonu (`buildCorporateEmailHtml`):** Gönderilen tüm mailler kurumsal logolu, `#C8102E` (kırmızı) ve `#0F172A` (lacivert) antetli, durum rozetli ve katılımcı tablolu profesyonel HTML formatındadır.
- **Kütüphane Müdürlüğüne (`DIRECTOR_EMAIL`) Giden 4 Kritik Operasyonel Rapor Maili:**
  1. *Oda Ayrıldı (`CONFIRMED` — `handleParticipantAcceptedEmails`):* Yalnızca yeterli davetli kabul edip oda ilk kez kesinleştiğinde (`didConfirmReservation`) müdüre 1 kez gider.
  2. *Randevu Başladı (`CHECKED_IN` — `sendKioskCheckInEmailToStaff`):* Kapıda en az 2 grup üyesi QR okutup odayı açtığında yoklama listesiyle birlikte gider.
  3. *Onaylı Randevu İptali (`sendReservationCancelledEmails`):* Kesinleşmiş bir randevu iptal edildiğinde tüm grupla birlikte müdüre de bilgi verir.
  4. *Otomatik Kiosk No-Show & Uyarı Raporu (`sendNoShowWarningEmail`):* Süresi içinde QR okutulmadığı için iptal edilen odanın yoklama ve ceza özetini raporlar.

### 5.4. 6 Sekmeli Modüler Yönetim, Analitik, A4 PDF Faaliyet Raporu ve Denetim Merkezi (`AdminPanel.jsx`, `components/admin/*` & `admin/manage/handlers.js`)
Yönetim paneli, yüksek bakım kolaylığı için Frontend'de 6 bağımsız alt bileşene (`components/admin/*`), Backend'de ise yönlendirici (`route.js`) ve aksiyon işleyicisi (`handlers.js`) katmanlarına ayrılmıştır:

| Sekme / Modül | Frontend Bileşeni | Backend Aksiyonu (`handlers.js`) | Yetkili Roller ve Fonksiyonel Özeti |
| :--- | :--- | :--- | :--- |
| **Sekme 1: Analitik & A4 PDF Rapor** | `AnalyticsTab.jsx` | `GET /api/admin/manage` | Gelecek 1 saat operasyon radarı, 24 saatlik oda yoğunluk grafiği (`RoomDensityChart`), bölüm dağılımı, iptal pasta grafiği, 7x24 Yoğunluk Isı Haritası (`heatmapMatrix`) ve tek tıkla A4 PDF faaliyet raporu çıktısı (`window.print()`). |
| **Sekme 2: Canlı Rezervasyonlar** | `ReservationsTab.jsx` | `FORCE_CONFIRM`, `MARK_NO_SHOW`, `ADMIN_CANCEL` | Telefon numarası (`📞`) destekli arama; görevliler için tek tıkla zorla onaylama, adil No-Show işaretleme ve mazeretli iptal. |
| **Sekme 3: Oda Yönetimi** | `RoomsTab.jsx` | `ROOM_ACTION` (`CREATE`, `UPDATE`, `TOGGLE_MAINTENANCE`) | Yeni çalışma odası ekleme, kapasite/özellik düzenleme ve mevcut onaylı randevuları iptal etmeden odayı zarifçe bakım moduna (`MAINTENANCE`) alma. |
| **Sekme 4: Duyuru Merkezi** | `AnnouncementsTab.jsx` | `CREATE_ANNOUNCEMENT` | `URGENT`, `HIGH`, `MEDIUM`, `LOW` önceliklerinde çift dilli (`TR`/`EN`) duyuru yayınlama ve silme. |
| **Sekme 5: Kullanıcı Moderasyonu** | `UsersTab.jsx` | `USER_MODERATION` (`BAN_USER`, `UNBAN`, `RESET_PENALTY`, `CHANGE_ROLE`) | Takvimli (`+7`, `+14`, `+30`, `+90` gün) veya Kalıcı (Perma) ban atma, ban kaldırma, ceza sıfırlama ve sıkı rol hiyerarşisi (`ADMIN` yalnızca `STUDENT <-> LIBRARIAN` atayabilir; `ADMIN` ve `SUPER_ADMIN` yetkisini yalnızca `SUPER_ADMIN` atayabilir). |
| **Sekme 6: 7 Dinamik Kural & Loglar** | `RulesAndLogsTab.jsx` | `UPDATE_RULE`, `CREATE_AGREEMENT` | 7 rezervasyon kuralını canlı güncelleme, yeni sözleşme versiyonu (`v1.1` vb.) yayınlama ve 180 günlük denetim loglarını (`AuditLog`) inceleme. |

### 5.5. İleri Seviye Kullanıcı Deneyimi (UX) veGerçek Zamanlı Oda Filtreleme (`StudyRooms.jsx`, `ReserveForm.jsx`, `MyBookings.jsx`, `Navbar.jsx`)
- **Gerçek Zamanlı Saat ve Süre Filtrelemesi (`hasContinuousAvailableSlot`):** `StudyRooms.jsx` ekranında öğrenci tarih, saat aralığı ve süre (örn. 2 saat) seçtiğinde, o aralıkta kesintisiz boşluğu olmayan odalar anında filtrelenir ve seçilen tarih doğrudan `ReserveForm.jsx` sayfasına aktarılır.
- **Tam Ban Kilidi Tutarlılığı:** Banlı (`isBanned`) öğrenciler için `Dashboard.jsx`, `MyBookings.jsx` ve `StudyRooms.jsx` sayfalarındaki *"Oda Rezerve Et"*, *"Odayı Seç"* ve *"Grup Davetini Kabul Et"* butonlarının tamamı kilitlenerek (`disabled`) *"Hesap Askıda / Suspended"* moduna alınmıştır.
- **Akıllı Katılımcı Ekleme:** Rezervasyon formunda öğrenci arkadaşının e-postasını kutuya yazıp *"Ekle"* butonuna basmayı unutsa dahi sistem geçerli e-postayı otomatik olarak gruba dahil eder.
- **Zaman Kilitli Erken Boşaltma ve İptal:** *"Odayı Erken Boşalt"* (`EARLY_CHECKOUT`) butonu yalnızca randevu saati aktif olarak başladığında açılır ve odayı kalan süre için diğer öğrencilere açar; *"İptal Et"* butonu ise başlangıca `CANCEL_LOCK_MINUTES` (60 dk) kala otomatik kilitlenir.

---

##  6. Veritabanı Mimarisi (Prisma Schema) ve Redis Anahtar Haritası

### 6.1. PostgreSQL / Prisma Tabloları (`backend/prisma/schema.prisma`)
Sistem 20 ilişkisel tablo ve 9 enum tipinden oluşur; başlıca çekirdek modeller şunlardır:

| Model Adı | Temel Alanlar ve İlişkiler | Mimari Görevi |
| :--- | :--- | :--- |
| **`User`** | `role`, `phone`, `avatarUrl`, `penaltyPoints`, `isBanned`, `bannedUntil`, `banReason`, `acceptedAgreementVersion` | Öğrenci ve personel kimlik, yetki, sözleşme ve disiplin durumu |
| **`Room`** | `name`, `roomNumber`, `capacity`, `status` (`AVAILABLE`, `MAINTENANCE`), `features` | Grup çalışma odaları (`R101`–`R104`) ve donanım özellikleri |
| **`Reservation`** | `reservationDate`, `startTime`, `endTime`, `status`, `checkedInAt`, `reminderSent` | Randevu zaman dilimleri ve yaşam döngüsü durum makinesi |
| **`ReservationParticipant`** | `reservationId`, `userId`, `status` (`PENDING`, `ACCEPTED`, `REJECTED`) | Grup üyelerinin davet ve katılım onay kayıtları |
| **`PenaltyHistory`** | `userId`, `reservationId`, `penaltyType` (`NO_SHOW`), `penaltyPoints`, `isActive` | Öğrencilerin aldığı `1/3`, `2/3`, `3/3` uyarıların tarihçesi |
| **`ReservationRule`** | `ruleKey`, `ruleValue`, `description`, `isActive` | Yönetim panelinden canlı değiştirilebilen 7 dinamik sistem kuralı |
| **`SystemAgreement`** | `version`, `title`, `content` (JSON `tr`/`en`), `isActive` | Versiyonlu ve çift dilli zorunlu kullanıcı sözleşmesi |
| **`Announcement` & `Notification`** | `title`, `content`, `priority`, `isRead` | Çok dilli kütüphane duyuruları ve kullanıcı içi bildirimler |
| **`EmailQueue`** | `recipientEmail`, `subject`, `body`, `status` (`PENDING`, `SENT`, `FAILED`), `attempts` | Hata toleranslı kurumsal SMTP e-posta gönderim kuyruğu |
| **`AuditLog` & `AdminAction`** | `userId`, `action`, `details`, `ipAddress`, `createdAt` | Öğrenci, otomasyon ve yönetici denetim izi (log) tabloları |

### 6.2. Redis Bellek İçi Anahtar Mimarisi (`backend/src/lib/redis.js` & `kioskSecurity.js`)

| Redis Anahtar Deseni | Veri Tipi | Yaşam Süresi (TTL) | Kullanım Amacı |
| :--- | :---: | :---: | :--- |
| `kiosk:personal_otp:${reservationId}:${userId}` | `String` | `900 sn` (15 dk) | Kapı QR okutulduğunda üretilen tek kullanımlık kişisel doğrulama jetonu |
| `kiosk:checked_users:${reservationId}` | `Set` | `14400 sn` (4 saat) | Odaya kapıda QR okutarak giriş onayı vermiş grup üyelerinin kümesi |
| `kiosk:devlock:${reservationId}:${deviceToken}` | `String` | `14400 sn` (4 saat) | Tarayıcı `Cookie` / `localStorage` cihaz kimliği kilidi |
| `kiosk:hwlock:${reservationId}:${hwFingerprint}` | `String` | `14400 sn` (4 saat) | Gizli sekme (Incognito) korumalı WebGL GPU donanım parmak izi kilidi |
| `kiosk:iplock:${reservationId}:${ipUaHash}` | `String` | `14400 sn` (4 saat) | Eduroam ortak NAT IP uyumlu, donanım tuzlamalı `IP + User-Agent` kilidi |

---

##  7. Bileşen Düzeyinde Teknik Dokümantasyon ve Geliştirme Kuralları (50/50 AI-Ready Docs)

Projenin sürdürülebilirliğini sağlamak, gelecekte projeye dahil olacak mühendislerin ve yapay zeka asistanlarının sistemi saniyeler içinde kavramasını garantilemek amacıyla projedeki **50 kaynak kod modülünün tamamı için** [`frontend/docs/`](/frontend/docs/README.md) (21 dosya) ve [`backend/docs/`](/backend/docs/README.md) (29 dosya) dizinlerinde özel teknik Markdown (`.md`) kılavuzları oluşturulmuştur.

### Geliştirme ve Koruma İlkeleri (Engineering Guidelines)
1. **Strict MUI & Theme-First:** Tüm arayüz bileşenleri Material-UI (`Box`, `Stack`, `Card`, `Typography`, `Chip`) ve `theme.js` üzerinden şekillendirilir.
2. **Merkezi Türkiye Saat Dilimi (`Europe/Istanbul`):** Sunucu veya istemci hangi coğrafi bölgede çalışırsa çalışsın tüm tarih ve dakika hesaplamaları Backend'de `@/lib/timeUtils`, Frontend'de `src/utils/dateUtils` üzerinden `Europe/Istanbul` saat dilimine ve `1970-01-01T...Z` sahte-UTC standardına göre normalize edilir.
3. **SOLID Servis Ayrımı:** Prisma bağlantıları yalnızca `@/lib/db` singleton modülü üzerinden, Kiosk güvenlik kontrolleri `@/lib/kioskSecurity` üzerinden, cezalar `@/lib/penaltyService` üzerinden, e-posta gönderimleri ise arayüzü bloklamadan `@/lib/emailService` içindeki güvenli kuyruk (`queueSafeEmail`) üzerinden yürütülür.

---

##  8. Sonuç

**THKÜ 7/24 Kütüphane Grup Çalışma Odaları Rezervasyon ve Kiosk Yoklama Sistemi**; kurumsal kimlik doğrulama, fiziksel Kiosk/donanım güvenliği, otonom yaşam döngüsü motoru ve modüler analitik yönetim bileşenleriyle:
- **Suistimale kapalı** *(4 katmanlı Kiosk + WebGL GPU Donanım Kilidi + Eduroam NAT uyumluluğu)*,
- **Kendi kendini yöneten** *(Otonom No-Show, Adil Ceza, 3/3 Otomatik Ban ve Walk-In Oda Yönetimi)*,
- **Tam denetlenebilir** *(180 Günlük Denetim Logları, 7x24 Isı Haritası ve A4 PDF Faaliyet Raporu)*,
- **Uluslararası standartlarda** *(TR/EN Çift Dil, SOLID Mimari ve 50 Modüllük Teknik Dokümantasyon)*

üretim (**Production**) seviyesine ulaştırılmıştır.

---

<div align="center">
  <sub>© 2026 <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> • Geliştirici: <b>Bora Avcu</b></sub>
</div>
