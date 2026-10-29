#  THK Üniversitesi 7/24 Kütüphane Grup Çalışma Odaları Rezervasyon ve Kiosk Yoklama Sistemi
### Kurumsal Sistem Mimarisi, Güvenlik Standartları ve Mühendislik Dokümantasyonu (v1.0 – v4.0 Production)

---

##  1. Proje Özeti ve Mimari Vizyon (Executive Overview)

Bu proje, **Türk Hava Kurumu Üniversitesi (THKÜ)** öğrencileri, akademisyenleri ve kütüphane yönetimi için kurumsal standartlarda geliştirilmiş, **7/24 kesintisiz hizmet veren tam otonom bir Grup Çalışma Odaları Rezervasyon, Fiziksel Kiosk QR Yoklama ve Analitik Yönetim Sistemidir**.

Sistem; kurumsal güvenlik, sıfır suistimal ve otonom operasyon prensipleriyle uçtan uca aşağıdaki yetenekleri tek bir çatı altında toplar:
- **Microsoft Entra ID (Azure AD) Tekil Oturum Açma (SSO) ve Alt Alan Adı (Subdomain) Rol İzolasyonu**,
- **4 Katmanlı Fiziksel Kiosk Güvenliği ve Gizli Sekme (Incognito) Korumalı WebGL Donanım Parmak İzi Kilidi**,
- **Her 30 Saniyede Bir Çalışan Otonom Yaşam Döngüsü, Adil No-Show Cezası ve Otomatik Ban Motoru (`lifecycle.js`)**,
- **Boşa Düşen Odaları Ara Dakikalarda Saniyesinde Kullanıma Açan Dinamik "Walk-In" Zaman Penceresi Algoritması**,
- **Olay Güdümlü (Event-Driven) Asenkron Kurumsal HTML E-Posta Bildirim Altyapısı (`mail.thk.edu.tr`)**,
- **7/24 Yoğunluk Isı Haritası, Bölüm/Oda Analizleri ve A4 PDF Faaliyet Raporu Üreten 6 Sekmeli Yönetim Merkezi**.

---

##  2. Teknoloji Yığını ve Altyapı Mimarisi (Tech Stack)

Proje; yüksek erişilebilirlik, sıfır yarış durumu (race-condition) ve hızlı yanıt süreleri için ayrıştırılmış (decoupled) modern bir Full-Stack JavaScript mimarisi üzerine inşa edilmiştir:

- **Frontend (İstemci Katmanı):** React.js (Vite), React Router v6, Material-UI (`@mui/material` v5)
- **Tasarım Sistemi (Design System):** Özel `theme.js` yapılandırması (Kurumsal renk paleti, tipografi hiyerarşisi ve `@media print` A4 raporlama uyumluluğu)
- **Çoklu Dil Desteği (i18n):** `i18next` & `react-i18next` ile tüm arayüz, sözleşme ve bildirimlerde **%100 Türkçe (`TR`) ve İngilizce (`EN`)** çift dil desteği
- **Backend (Sunucu & API Katmanı):** Next.js App Router API Routes (`/api/*`) ve Edge Middleware
- **Kimlik Doğrulama (SSO):** `next-auth` — Microsoft Entra ID (`azure-ad` OAuth 2.0 / OpenID Connect) + Ortam değişkeni kontrollü güvenli Demo/Sunum Modu
- **İlişkisel Veritabanı & ORM:** PostgreSQL & Prisma ORM v5.22 (`db.js` üzerinde Connection Pool taşmasını önleyen *Singleton* tasarım deseni)
- **Bellek İçi Önbellek & Kiosk Durum Motoru:** Redis (`ioredis` — Tek kullanımlık Kiosk OTP jetonları, gerçek zamanlı grup yoklama kümeleri ve 4 saatlik cihaz/donanım kilitleri)
- **Kurumsal E-Posta Motoru:** `nodemailer` (`mail.thk.edu.tr` TLS/587 entegrasyonu, `EmailQueue` veritabanı kuyruğu ve THKÜ logolu duyarlı HTML şablon motoru)

---

##  3. NextAuth + Microsoft Azure AD (Entra ID) Tam Akış ve Rol Mimarisi

### 3.1. Amaç ve Alan Adı (Domain) Ayrımı
Sistem, tek bir Microsoft Azure AD kurumsal giriş kapısı üzerinden hem öğrencileri hem de kütüphane ve bilgi işlem yetkililerini doğrulamak ve yetkilerine göre izole edilmiş panellere yönlendirmek amacıyla tasarlanmıştır:

- `Daha Sonra Girilecektir, Şu an Belli Değil.` → **Öğrenci Çalışma Odası Portalı** (`STUDENT`)
- `Daha Sonra Girilecektir, Şu an Belli Değil.` → **Kütüphane Yönetim & Analiz Merkezi** (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`)

### 3.2. Detaylı OAuth 2.0 / OpenID Connect Akış Adımları
1. **Adım 1 — Kullanıcı Giriş Talebi:** Kullanıcı `Login.jsx` ekranında *"Microsoft ile Giriş Yap"* butonuna tıklar (`Frontend → /api/auth/signin/azure-ad`).
2. **Adım 2 — NextAuth Provider Başlatma:** Backend tarafında NextAuth; `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_URL` ve `NEXTAUTH_SECRET` parametreleriyle OAuth akışını başlatır.
3. **Adım 3 — Azure AD’ye Yönlendirme:** Kullanıcı Microsoft Entra ID oturum açma sayfasına yönlendirilir.
4. **Adım 4 — Kurumsal Kimlik Doğrulama:** Azure AD kullanıcı adını, parolayı ve kurumsal MFA süreçlerini doğrular; yalnızca `@stu.thk.edu.tr` ve `@thk.edu.tr` uzantılı kurumsal hesaplara izin verilir.
5. **Adım 5 — Callback İşlemi:** Doğrulama sonrası kullanıcı `/api/auth/callback/azure-ad` uç noktasına döndürülür; authorization code ile access/id token değişimi yapılır.
6. **Adım 6 — Session / JWT Oluşturma:** NextAuth kullanıcı için `NEXTAUTH_SECRET` ile kriptografik olarak imzalanmış JWT oturumu üretir.
7. **Adım 7 — Kullanıcı Bilgisinin İşlenmesi ve Otonom Denetim:**
   - Kullanıcı veritabanında yoksa `STUDENT` rolüyle otomatik oluşturulur; varsa Microsoft profil fotoğrafı (`avatarUrl`) senkronize edilir (mevcut yetkili rolleri korunur, ezilmez).
   - **Otomatik Ban Açma (`Auto-Unban`):** Kullanıcının `isBanned` durumu `true` ise ancak `banUntil` tarihi dolmuşsa, sistem giriş anında kullanıcının banını ve ceza puanlarını otomatik sıfırlar, aktif `PenaltyHistory` kayıtlarını pasife çeker.
   - Kullanıcının güncel `noShowCount` (aktif uyarı sayısı), `isBanned`, `banUntil`, `banReason` ve `acceptedAgreementVersion` bilgileri doğrudan `session.user` nesnesine gömülür.
8. **Adım 8 — Yetkilendirme, Sözleşme ve Yönlendirme:**
   - Kullanıcı aktif sözleşmeyi (`v1.0`) henüz onaylamamışsa zorunlu olarak `/rules` (`RulesAcceptance.jsx`) sayfasına yönlendirilir.
   - `ADMIN` ve `SUPER_ADMIN` doğrudan `/admin` paneline; `STUDENT` ise `/dashboard` ekranına yönlendirilir.

### 3.3. Mantıksal Akış Diyagramı

    [Kullanıcı Tarayıcısı]
              |
              v
    [Frontend Login Ekranı (Login.jsx)]
              |
              v
    ["Microsoft ile Giriş Yap"]
              |
              v
    [Backend /api/auth/signin/azure-ad]
              |
              v
    [NextAuth Azure AD Provider]
              |
              v
    [Microsoft Entra ID / Azure AD Login (@stu.thk.edu.tr / @thk.edu.tr)]
              |
              v
    [Backend /api/auth/callback/azure-ad]
              |
              v
    [NextAuth JWT & Session Oluşturma (NEXTAUTH_SECRET)]
              |
              +-----------------------------------+
              |                                   |
              v                                   v
    [Prisma / PostgreSQL]               [Edge Middleware & Session]
    (Upsert, Avatar Sync, Auto-Unban)   (panel.library.thk.edu.tr Rol Duvarı)
              |                                   |
              +-----------------+-----------------+
                                |
                                v
             [Sözleşme (v1.0) / Rol / Ban Kontrolü]
                                |
                 +--------------+--------------+
                 |                             |
                 v                             v
       [Öğrenci: /dashboard]        [Yetkili: /admin & /kiosk]

### 3.4. Olası Kimlik Doğrulama Hata Senaryoları ve Çözümleri
- **`AADSTS90112` (Application identifier is expected to be a GUID):** `AZURE_AD_CLIENT_ID` yanlış girilmiş veya placeholder bırakılmıştır.
- **`NO_SECRET`:** `NEXTAUTH_SECRET` ortam değişkeni tanımlanmamıştır.
- **`OAuthSignin` Hatası:** Azure Portal'daki Redirect URI (`https://library.thk.edu.tr/api/auth/callback/azure-ad`) ile backend callback adresi uyuşmuyordur veya Client Secret süresi (`expire`) dolmuştur.

---

##  4. Kurumsal Güvenlik ve Secret Yönetim Mimarisi (Production & Key Vault Standartları)

### 4.1. Amaç ve Ortam Ayrımı
Geliştirme ortamında `.env` dosyasında tutulan hassas yapılandırma bilgilerinin (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `SMTP_PASS`), Production (Canlı) ortamda kaynak koddan ayrıştırılarak güvenli ortam değişkenleri veya **Azure Key Vault** üzerinde merkezi olarak yönetilmesi hedeflenmiştir.

### 4.2. Önerilen Key Vault Anahtar Standartları
- `library-reservation-azure-client-id`
- `library-reservation-azure-client-secret`
- `library-reservation-azure-tenant-id`
- `library-reservation-nextauth-secret`
- `library-reservation-database-url`

### 4.3. Periyodik Secret Rotation (Şifre Yenileme) Prosedürü
Azure AD Client Secret değerleri belirli bir süre sonunda sona erecek (`expire`) şekilde üretilir. Süre dolmadan önce:
1. `Azure Portal → App Registrations → Certificates & Secrets` üzerinden yeni Client Secret üretilir.
2. Yeni değer üretim ortamı değişkenlerine veya Key Vault'a tanımlanır.
3. Backend servisi yeniden başlatılır ve eski secret devre dışı bırakılır.
4. `.env` dosyaları hiçbir koşulda Git versiyon kontrolüne (`GitHub`) dahil edilmez.

---

##  5. Çekirdek Mühendislik Modülleri ve Sistem İnovasyonları

Sistemin fiziksel dünyada suistimal edilemeyen, kendi kendini yöneten (self-healing) kurumsal bir otomasyona dönüşmesi için aşağıdaki **5 çekirdek modül** tasarlanmış ve entegre edilmiştir:

### 5.1. 4 Katmanlı Fiziksel Kiosk Kapı QR ve "Anti-Incognito" Donanım Kilidi (`kiosk/qr`, `checkin/validate`, `api.js`)
Öğrencilerin kütüphaneye gelmeden uzaktan sahte yoklama vermesini veya kütüphaneye gelen tek bir öğrencinin kendi telefonundan (gizli sekme açarak) gelmeyen arkadaşlarının yerine QR onaylamasını engellemek için **4 aşamalı savunma hattı** uygulanır:
1. **Fiziksel Kapı QR Zorunluluğu:** Doğrudan menüden `/kiosk` adresine girilmesi engellenmiştir; yalnızca oda kapılarındaki A4 posterde yer alan `?door=thku-study-room` parametresiyle erişilebilir.
2. **Kampüs Wi-Fi (`eduroam` / `THKU-802.1x`), Mobil Veri ve Anti-VPN Denetimi:** İstemcinin `navigator.connection` ağ tipi (`x-net-type: cellular` engeli), okul VPN IP bloğu (`10.254.x.x` engeli) ve ULAKNET/THKÜ resmi IP blokları (`212.154.67.x`, `10.2.x.x`) gerçek zamanlı denetlenir.
3. **1 KM Haversine GPS Yarıçapı:** Tarayıcıdan alınan yüksek doğruluklu GPS koordinatları ile THKÜ Türkkuşu Kampüsü Kütüphane koordinatları (`39.945825, 32.690353`) arasındaki kuş uçuşu mesafe Haversine formülüyle hesaplanır; 1000 metre dışındaki cihazlar reddedilir.
4. **Gizli Sekme (Incognito) Korumalı WebGL Donanım Parmak İzi (`x-hardware-fp`):**
   - Öğrenci gizli sekme açıp çerezleri ve `localStorage`'ı sıfırlasa dahi, `api.js` cihazın **WebGL Ekran Kartı (GPU) Renderer modelini**, ekran çözünürlüğünü, renk derinliğini, CPU çekirdek sayısını ve saat dilimini **32-bit FNV-1a Hash** algoritmasıyla birleştirerek benzersiz bir donanım imzası (`hw_...`) üretir.
   - Bir telefondan A öğrencisi Check-In yaptığı saniye; o cihazın `httpOnly` çerezi, `localStorage` kimliği, `WebGL GPU` donanım imzası ve `IP+UserAgent` özeti Redis'te 4 saat boyunca (`TTL: 14400 sn`) sadece A öğrencisine kilitlenir. Aynı telefondan B öğrencisi adına giriş yapılıp onay verilmeye çalışıldığında sistem bunu anında yakalar ve reddeder.

### 5.2. Otonom Yaşam Döngüsü Motoru, Adil Disiplin Algoritması ve "Walk-In" (Boşa Düşen Oda) Yönetimi (`lifecycle.js`)
Sistemde hiçbir görevlinin manuel takibine gerek bırakmayan, her 30 saniyede bir çalışan otonom bir arka plan motoru (`runReservationLifecycleChecks`) yer alır:
- **30 Dakika Grup Davet Süre Aşımı:** Oluşturulmasının üzerinden 30 dakika geçtiği halde en az 1 davetli tarafından kabul edilmeyen `PENDING` randevular otomatik iptal edilir (`AUTO_TIMEOUT_CANCELLED`) ve oda takvimde boşa çıkarılır.
- **En Az 2 Kişi Kapı QR Kuralı:** Kapıdaki QR kodu sadece 1. kişi okuttuğunda oda henüz `CHECKED_IN` olmaz; en az `MIN_PARTICIPANTS` (2 kişi) kendi mobil cihazından okuttuğunda oda açılır.
- **Adil No-Show Cezası (`verifiedUsers` vs `absentUsers`):** Randevu başlangıcından `+15 dakika` (`CHECKIN_TOLERANCE_MINUTES`) geçtiği halde yeterli kişi QR okutmadıysa randevu `NO_SHOW` olarak iptal edilir ve oda anında diğer öğrencilere açılır. **Kritik Adalet Kuralı:** Grupta kütüphaneye gelip kendi QR kodunu okutmuş olan öğrenci varsa (`verifiedUsers`), arkadaşları gelmediği için mağdur edilmez ve **ona kesinlikle ceza puanı yazılmaz**; yalnızca QR okutmayan üyelere (`absentUsers`) `1/3 No-Show` uyarısı (`15 puan`) işlenir.
- **3/3 Otomatik Ban Mekanizması:** Dönem içinde 3. kez No-Show yapan (`45 puan`) öğrenci sistem tarafından otomatik olarak **30 gün süreyle yasaklanır (`AUTO_NO_SHOW_BANNED`)** ve gelecekteki aktif randevuları iptal edilerek odalar boşa çıkarılır.
- **Normal Randevu vs. Ara Dakikada Boşa Düşen Oda (`getReservationKioskWindow`):**
  - Saat `16:00`'dan önce alınan normal randevuların (`createdAt <= startTotalMins`) Kiosk onay penceresi kesin olarak **`15:45 – 16:15`** aralığına sabitlenmiştir; davetin geç kabul edilmesi (`updatedAt`) bu süreyi asla uzatmaz.
  - Ancak `16:15`'te ilk grup gelmediği için `16:16`'da oda `NO_SHOW` olup boşa düştüğünde (veya erken boşaltıldığında), saat `16:20`'de kütüphaneye gelen yeni bir grup `17:00`'ı beklemek zorunda kalmadan doğrudan `16:00 – 18:00` dilimini rezerve edebilir (`ReserveForm.jsx`). Sistem bu yeni randevunun `16:00`'dan sonra (`createdAt > startTotalMins`) sıfırdan açıldığını algılar ve yeni gruba odaya girerken hemen okutabilmeleri için **`[createdAt, createdAt + 15 dk]` (`16:20 – 16:35`)** Kiosk penceresi tanımlar.

### 5.3. Olay Güdümlü (Event-Driven) Asenkron Kurumsal HTML E-Posta Motoru (`lifecycle.js`)
- **Sıfır Arayüz Beklemesi (Zero-Lag):** Davet kabulü ve rezervasyon işlemlerinde kullanıcı arayüzünün SMTP yanıtını bekleyip 5-10 saniye donmaması için tüm e-posta tetiklemeleri arka planda asenkron (`.catch()`) çalıştırılır.
- **THKÜ Kurumsal HTML Şablonu (`buildCorporateEmailHtml`):** Gönderilen tüm mailler THKÜ logolu, kurumsal kırmızı/lacivert antetli, durum rozetli ve katılımcı tablolu profesyonel HTML formatındadır.
- **Kütüphane Müdürlüğüne (`library@thk.edu.tr`) Giden 4 Kritik Operasyonel Rapor Maili:**
  1. *Oda Ayrıldı (`CONFIRMED`):* Yalnızca 2. kişi daveti kabul edip oda kesinleştiğinde (`isInitialConfirmation`) müdüre 1 kez gider (3., 4. kişilerde gereksiz mail trafiği yaratmaz).
  2. *Randevu Başladı (`CHECKED_IN`):* Kapıda en az 2 grup üyesi QR okutup odayı açtığında gider.
  3. *Onaylı Randevu İptali:* Kesinleşmiş bir randevu iptal edildiğinde tüm grupla birlikte müdüre de bilgi verir.
  4. *Otomatik Kiosk No-Show İptal Raporu:* Süresi içinde QR okutulmadığı için otomatik iptal edilen odanın yoklama ve ceza özetini raporlar.

### 5.4. 6 Sekmeli Yönetim, Analitik, A4 PDF Faaliyet Raporu ve Denetim Merkezi (`AdminPanel.jsx` & `admin/manage/route.js`)
Kütüphane Görevlisi (`LIBRARIAN`), Kütüphane Müdürü (`ADMIN`) ve BİM Yöneticisi (`SUPER_ADMIN`) için kademeli yetki hiyerarşisine sahip tam kapsamlı bir yönetim paneli sunulmaktadır:
- **Sekme 0 — Yoğunluk Analizi & A4 PDF Faaliyet Raporu:**
  - *Gelecek 1 Saat Operasyon Radarı*, *24 Saatlik Oda Yoğunluk Grafiği (`RoomDensityChart`)*, *Bölüm Bazlı Kullanım Dağılımı*, *Oda Tercih Sıralaması* ve *7/24 Saatlik Yoğunluk Isı Haritası (Peak Hours Heatmap)* sunar.
  - **Tek Tıkla A4 PDF Çıktısı:** `window.print()` çağrıldığında tüm menüler gizlenir, resmi THKÜ rapor anteti açılır ve grafik kartları `breakInside: 'avoid'` kuralıyla sayfa ortasında bölünmeden A4 faaliyet raporuna dönüşür.
- **Sekme 1 — Telefon Numarası Destekli Canlı Rezervasyon Yönetimi:**
  - Öğrencilerin profilde tanımladığı acil durum telefon numaraları (`📞`) hem arama çubuğuna hem de rezervasyon/öğrenci kartlarına entegre edilmiştir.
  - Görevliler tek tıkla *Manuel Check-In (`FORCE_CHECKIN`)*, *Erken Boşaltma (`EARLY_FINISH`)*, *No-Show İşaretleme (`MARK_NO_SHOW`)* ve *İptal (`CANCEL`)* yapabilir.
- **Sekme 2 — Oda Yönetimi ve Zarif Bakım Modu (`TOGGLE_ROOM`):**
  - Odalar (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) anahtardan kapatıldığında **mevcut onaylı randevular iptal edilmez**; yalnızca odaya yeni randevu alınması durdurulur.
- **Sekme 3 — Çok Dilli (`TR`/`EN`) ve Öncelikli Duyuru Merkezi:**
  - `URGENT`, `HIGH`, `MEDIUM`, `LOW` önceliklerinde çift dilli duyuru yayınlama ve silme imkanı sunar.
- **Sekme 4 — Öğrenci Moderasyonu, Takvimli/Kalıcı Ban ve Rol Hiyerarşisi:**
  - Yöneticiler öğrencilere takvimden tarih seçerek (`+7`, `+14`, `+30`, `+90` gün çipleriyle) veya **Kalıcı (Perma)** olarak ban atabilir, ban kaldırabilir ve uyarı sayaçlarını sıfırlayabilir.
  - **Sıkı Rol Hiyerarşisi:** `ADMIN` (Kütüphane Müdürü) yalnızca `STUDENT <-> LIBRARIAN` ataması yapabilir; başka bir `ADMIN` veya `SUPER_ADMIN` atamasını yalnızca `SUPER_ADMIN` (BİM) yapabilir.
- **Sekme 5 — 7 Dinamik Kural Motoru ve 180 Günlük Simetrik Denetim Logları:**
  - Kod değişikliğine gerek kalmadan 7 rezervasyon kuralı (`MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`, `MAX_DURATION_HOURS`, `MAX_ADVANCE_DAYS`, `DAILY_RELEASE_HOUR`, `CHECKIN_TOLERANCE_MINUTES`, `CANCEL_LOCK_MINUTES`) panelden anında değiştirilebilir.
  - Öğrenci/Sistem logları (`AuditLog`) ve Yönetici müdahale logları (`AdminAction`) **180 gün aktif görünüm / 365 gün otomatik arşiv temizliği** politikasıyla yan yana eşit boyda (`minHeight: 118px`) listelenir.

### 5.5. İleri Seviye Kullanıcı Deneyimi (UX) ve Rol İzolasyonu (`Dashboard`, `MyBookings`, `StudyRooms`, `Navbar`)
- **Tam Ban Kilidi Tutarlılığı:** Banlı (`isBanned`) öğrenciler için sadece ana sayfadaki değil, `MyBookings.jsx` ve `StudyRooms.jsx` sayfalarındaki *"Oda Rezerve Et"*, *"Odayı Seç"* ve *"Grup Davetini Kabul Et"* butonlarının tamamı grileştirilerek (`disabled`) *"Hesap Askıda / Suspended"* moduna alınmıştır.
- **Akıllı Katılımcı Ekleme (`pendingTypedEmail`):** Rezervasyon formunda öğrenci arkadaşının e-postasını kutuya yazıp *"Ekle"* butonuna basmayı unutsa dahi sistem geçerli e-postayı otomatik olarak gruba dahil eder.
- **Zaman Kilitli Erken Boşaltma ve İptal:** *"Odayı Erken Boşalt"* butonu yalnızca randevu saati aktif olarak başladığında (`isHappeningNow`) açılır; *"İptal Et"* butonu ise başlangıca `CANCEL_LOCK_MINUTES` (60 dk) kala otomatik kilitlenir.
- **İnteraktif Bildirim Merkezi (`Navbar.jsx`):** Öğrenciler sağ üstteki bildirim zilinden gelen grup davetlerini başka sayfaya gitmeden açılan pop-up modal içinden anında kabul veya reddedebilir.

---

##  6. Veritabanı Mimarisi (Prisma Schema) ve Redis Anahtar Haritası

### 6.1. PostgreSQL / Prisma Tabloları (`backend/prisma/schema.prisma`)
Sistem 20 ilişkisel tablo ve 9 enum tipinden oluşur:
- **`User`:** Öğrenci ve personel kayıtları, `role`, `phone`, `avatarUrl`, `penaltyPoints`, `isBanned`, `banUntil`, `banReason`, `acceptedAgreementVersion`.
- **`Room`:** Çalışma odaları (`R101`–`R104`), kapasite ve aktiflik durumu.
- **`Reservation` & `ReservationParticipant`:** Randevu zamanları, durumları (`PENDING`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), `checkedInAt` ve grup katılımcı onayları.
- **`PenaltyHistory`:** Öğrencilerin aldığı `NO_SHOW` uyarılarının (`15 puan`) aktif/pasif tarihçesi.
- **`ReservationRule` & `Agreement`:** 7 dinamik sistem kuralı ve versiyonlu (`v1.0`) kullanıcı sözleşmesi.
- **`Announcement`, `Notification` & `EmailQueue`:** Çok dilli duyurular, bildirimler ve hata toleranslı SMTP e-posta kuyruğu.
- **`AuditLog` & `AdminAction`:** Öğrenci, otomasyon ve yönetici denetim izi tabloları.

### 6.2. Redis Bellek İçi Anahtar Mimarisi (`backend/src/lib/redis.js`)
- `kiosk:personal_otp:${reservationId}:${userId}` (`TTL: 600s`) — Kapı QR okutulduğunda üretilen tek kullanımlık kişisel doğrulama jetonu. - `kiosk:checked_users:${reservationId}` (`Set, TTL: 14400s`) — Odaya giriş onayı vermiş grup üyelerinin kümesi.
- `kiosk:device_lock:${reservationId}:${deviceId}` (`TTL: 14400s`) — Tarayıcı cihaz kimliği kilidi.
- `kiosk:hw_lock:${reservationId}:${hwFp}` (`TTL: 14400s`) — Gizli sekme (Incognito) korumalı WebGL GPU donanım parmak izi kilidi.
- `kiosk:ipua_lock:${reservationId}:${ipUaHash}` (`TTL: 14400s`) — Ağ ve tarayıcı üstbilgi özeti kilidi.

---

##  7. Bileşen Düzeyinde Teknik Dokümantasyon ve Geliştirme Kuralları (43/43 AI-Ready Docs)

Projenin sürdürülebilirliğini sağlamak, gelecekte projeye dahil olacak mühendislerin ve yapay zeka asistanlarının (Cursor / LLM) sistemi saniyeler içinde kavramasını garantilemek amacıyla projedeki **43 kaynak kod dosyasının tamamı için** `frontend/docs/` (18 dosya) ve `backend/docs/` (25 dosya) dizinlerinde özel teknik Markdown (`.md`) kılavuzları oluşturulmuştur.

### Geliştirme ve Koruma İlkeleri (Engineering Guidelines)
1. **Strict MUI & Theme-First:** Tüm arayüz bileşenleri Material-UI (`Box`, `Stack`, `Card`, `Typography`, `Chip`) ve `theme.js` üzerinden şekillendirilir.
2. **Türkiye Saat Dilimi (`Europe/Istanbul`) Standartları:** Sunucu hangi coğrafi bölgede çalışırsa çalışsın tüm tarih ve dakika hesaplamaları `Europe/Istanbul` saat dilimine ve `1970-01-01T...Z` UTC saat standardına göre normalize edilir.
3. **Veritabanı ve SMTP Güvenliği:** Prisma bağlantıları yalnızca `@/lib/db` singleton modülü üzerinden çağrılır; e-posta gönderimleri ise arayüzü bloklamadan `@/lib/lifecycle` içindeki güvenli kuyruk (`queueSafeEmail`) üzerinden yürütülür.

---

##  8. Sonuç

**THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi**; kurumsal kimlik doğrulama, fiziksel Kiosk/donanım güvenliği, otonom yaşam döngüsü motoru ve analitik yönetim bileşenleriyle;
- **Suistimale kapalı (4 katmanlı Kiosk + WebGL Donanım Kilidi),**
- **Kendi kendini yöneten (Otonom No-Show, Otomatik Ban ve Walk-In Oda Yönetimi),**
- **Tam denetlenebilir (180/365 Günlük Loglar ve A4 PDF Faaliyet Raporu),**
- **Uluslararası standartlarda (TR/EN Çift Dil ve 43 Dosyalık Teknik Dokümantasyon)**

üretim (Production) seviyesine ulaştırılmıştır.