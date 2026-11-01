#  THKÜ 7/24 Kütüphane Grup Çalışma Odaları Rezervasyon ve Kiosk Yoklama Sistemi

[](https://nextjs.org/)
[](https://react.dev/)
[](https://mui.com/)
[](https://www.prisma.io/)
[](https://redis.io/)
[](https://next-auth.js.org/)
[](#)

**Türk Hava Kurumu Üniversitesi (THKÜ) Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü** için geliştirilmiş; **Microsoft Entra ID (Azure AD) SSO**, **4 Katmanlı Fiziksel Kiosk Kapı QR Güvenliği**, **Adil No-Show Ceza Motoru** ve **Canlı Yoğunluk Analitiği** barındıran tam otonom Full-Stack Rezervasyon Platformu.

>  **Hızlı Dokümantasyon Bağlantıları:**
> - [🇹🇷 Kurumsal Sistem Mimarisi (TR)](https://www.google.com/search?q=./docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md)
> - [🇬🇧 System Architecture (EN)](https://www.google.com/search?q=./docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md)
> - [📘 Backend Kod Dokümanları (29 Modül)](https://www.google.com/search?q=./backend/docs/README.md)
> - [📗 Frontend Kod Dokümanları (21 Modül)](https://www.google.com/search?q=./frontend/docs/README.md)

---

##  1. Projenin Amacı ve Çözdüğü Problemler

Üniversite kütüphanelerindeki grup çalışma odalarında sıkça yaşanan **"odayı rezerve edip gelmeme (hayalet rezervasyon)"**, **"tek kişiyle 6 kişilik odayı kapatma"** ve **"kütüphanede olmadan uzaktan sahte yoklama verme"** sorunlarını ortadan kaldırmak amacıyla **SOLID** prensiplerine uygun olarak tasarlanmıştır:

1. **7/24 Kesintisiz Hizmet ve Dinamik Kurallar:**
   - Kütüphanedeki 4 grup çalışma odası (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) haftanın 7 günü 24 saat (`00:00 – 24:00`) kesintisiz hizmet verir.
   - Tüm rezervasyon kuralları (`Min/Max Katılımcı`, `Maksimum Süre`, `Kaç Gün Önceden Alınabileceği`, `Sabah Kota Açılış Saati`, `Kiosk Yoklama Toleransı`, `İptal Kilidi`) kod değişikliği gerektirmeden Yönetim Panelinden canlı olarak değiştirilebilir.
2. **4 Katmanlı Fiziksel Kiosk Kapı QR Güvenliği (`kioskSecurity.js`):**
   - **Katman 1 — Fiziksel Kapı QR Parametresi:** Yalnızca oda kapısındaki A4 posterde yer alan `?door=thku-study-room` imzalı bağlantı kabul edilir.
   - **Katman 2 — Kampüs Wi-Fi (`eduroam`) & VPN/Hücresel Veri Engeli:** İstemci ağ tipi (`Network Information API`) ve IP önekleri denetlenir; hücresel veri (`4G/5G`) ve kurumsal VPN üzerinden uzaktan yoklama reddedilir.
   - **Katman 3 — 1 KM Kütüphane GPS Yarıçapı (`Haversine`):** Öğrencinin canlı GPS koordinatının kütüphane merkezine (`39.945825, 32.690353`) en fazla **1000 metre** mesafede olması zorunludur.
   - **Katman 4 — Gizli Sekme (Incognito) Korumalı Cihaz Kilidi:** `Cookie` + `localStorage` + `WebGL GPU Donanım Parmak İzi` + `IP + User-Agent + Ekran/CPU Hash` katmanları Redis üzerinde 4 saat boyunca mühürlenir. Bir öğrenci kendi telefonundan gizli sekme açarak gelmeyen arkadaşı adına ikinci kez QR okutamaz (Kampüs `eduroam` ortak NAT IP'sinde farklı telefonların birbirini bloklamaması için IP kilidi yalnızca donanım kimliğiyle birlikte değerlendirilir).
3. **Adil No-Show Cezası ve 3/3 Otomatik Ban (`lifecycle.js` & `penaltyService.js`):**
   - Grup davetleri **30 dakika** içinde en az 1 davetli tarafından onaylanmazsa randevu otomatik iptal edilir.
   - Randevu başlangıcından **±15 dakika** içinde en az 2 grup üyesi kapıdaki QR kodu okutmazsa randevu `NO_SHOW` olur ve oda saniyesinde diğer öğrencilere açılır.
   - Kapıya gelip QR okutan öğrenciye (`verifiedUsers`) **asla ceza yazılmaz**; yalnızca gelmeyen grup üyelerine (`absentUsers`) `1/3 No-Show` uyarısı işlenir. `3/3` olan öğrenci **30 gün boyunca** sistemden otomatik banlanır ve aktif/gelecek randevuları iptal edilir.
4. **Boşa Düşen Odayı Ara Dakikada Anında Tutma (`Walk-In`):**
   - İlk grup gelmediği veya `Odayı Erken Boşalt` (`EARLY_CHECKOUT`) yaptığı için ara dakikada (örneğin `16:20`'de) boşa düşen bir odayı aynı saat dilimi (`16:00 – 18:00`) için tutan yeni gruba, oluşturulma anından itibaren özel **15 dakikalık (`16:20 – 16:35`)** Kiosk onay penceresi tanımlanır.

---

##  2. Sistem Mimarisi ve Klasör Yapısı (SOLID)

Proje, yüksek bakım kolaylığı ve tek sorumluluk prensibi (**Single Responsibility Principle**) doğrultusunda modüler **Frontend** ve **Backend** katmanlarına ayrılmıştır:

```text
thku-library-reservation/
├── docker-compose.yaml                  # PostgreSQL 16 (5433) ve Redis (6379) konteyner orkestrasyonu
├── docs/                                # Kurumsal Sistem Mimarisi Dokümanları (TR & EN)
│   ├── THKU_LIBRARY_RESERVATION_SYSTEM_TR.md
│   └── THKU_LIBRARY_RESERVATION_SYSTEM_EN.md
│
├── backend/                             # Next.js 16 (App Router) Headless API & Otomasyon Sunucusu
│   ├── prisma/
│   │   ├── schema.prisma                # 20 Modelli İlişkisel PostgreSQL Şeması
│   │   └── seed.cjs                     # Zengin Analitik Demo ve Başlangıç Veri Tohumlama Betiği
│   ├── src/
│   │   ├── lib/                         # Çekirdek Servis Katmanı (SOLID)
│   │   │   ├── db.js                    # Prisma Client Singleton
│   │   │   ├── redis.js                 # Redis İstemci Singleton
│   │   │   ├── timeUtils.js             # Merkezi Türkiye Saati (Europe/Istanbul) ve Kiosk Pencere Motoru
│   │   │   ├── kioskSecurity.js         # 4 Katmanlı GPS, Kampüs Wi-Fi ve WebGL Cihaz Kilidi Motoru
│   │   │   ├── emailService.js          # Nodemailer SMTP, EmailQueue ve Kurumsal HTML Şablon Motoru
│   │   │   ├── penaltyService.js        # Adil No-Show (1/3 -> 3/3) ve 30 Gün Otomatik Ban Motoru
│   │   │   └── lifecycle.js             # 30 Saniyelik Otonom Zamanlayıcı ve Durum Makinesi
│   │   ├── middleware/
│   │   │   └── checkRulesAcceptance.js  # Aktif Kullanıcı Sözleşmesi Versiyon Doğrulayıcı
│   │   ├── middleware.js                # panel.library.thk.edu.tr Edge JWT Rol Güvenlik Duvarı
│   │   └── app/api/                     # RESTful API Uç Noktaları
│   │       ├── admin/manage/            # route.js (Analitik GET) & handlers.js (8 İdari Aksiyon POST)
│   │       ├── auth/[...nextauth]/      # Azure AD SSO, Demo Giriş ve Otomatik Ban Açma (Auto-Unban)
│   │       ├── kiosk/qr/                # Kiosk Ön Doğrulama ve 15 Dakikalık OTP Jeton Üretimi
│   │       ├── checkin/validate/        # Kiosk Yoklama Onayı ve 2. Kişide Oda Açılışı
│   │       ├── reservations/            # Randevu Oluşturma, Erken Boşaltma ve İptal Kilidi
│   │       ├── invitations/             # Grup Daveti Listeleme ve Kabul/Red (PENDING -> CONFIRMED)
│   │       ├── rooms/                   # Gerçek Zamanlı Oda ve Saat Dilimi Müsaitlik Sorguları
│   │       └── ...                      # agreements, announcements, dashboard, profile, reserve, user
│   └── docs/                            # 29 Backend Dosyasının Bileşen Düzeyinde Teknik Dokümanı
│
└── frontend/                            # React 19 + Vite 7 + Material-UI v7 İstemci Uygulaması
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx               # Rol Duyarlı Üst Menü, Bildirim Merkezi ve TR/EN Dil Seçici
    │   │   ├── Footer.jsx               # Kurumsal Alt Bilgi ve Hızlı Bağlantılar
    │   │   ├── dashboard/
    │   │   │   └── RoomDensityChart.jsx # 24 Saatlik Oda Yoğunluk Sütun Grafiği
    │   │   └── admin/                   # Modüler Yönetim Paneli Alt Bileşenleri
    │   │       ├── adminConstants.js    # Ortak Renk, Rol, Aksiyon Rozeti ve Yardımcı Sabitler
    │   │       ├── AnalyticsTab.jsx     # Sekme 1: Yoğunluk Isı Haritası, İptal Pasta Grafiği, A4 Rapor
    │   │       ├── ReservationsTab.jsx  # Sekme 2: Canlı Randevu Arama, Zorla Onay, No-Show, İptal
    │   │       ├── RoomsTab.jsx         # Sekme 3: Oda Ekleme/Düzenleme ve Bakım Modu (MAINTENANCE)
    │   │       ├── AnnouncementsTab.jsx # Sekme 4: Çok Dilli (TR/EN) Duyuru Yayınlama Merkezi
    │   │       ├── UsersTab.jsx         # Sekme 5: Kullanıcı Arama, Takvimli/Kalıcı Ban ve Rol Yönetimi
    │   │       └── RulesAndLogsTab.jsx  # Sekme 6: 7 Dinamik Kural, Sözleşme Versiyonlama ve Loglar
    │   ├── pages/                       # Sayfa Bileşenleri
    │   │   ├── Login.jsx                # Microsoft Entra ID SSO ve Güvenli Demo Giriş Ekranı
    │   │   ├── RulesAcceptance.jsx      # 6 Maddelik TR/EN Zorunlu Sözleşme Onay Ekranı
    │   │   ├── Dashboard.jsx            # Öğrenci Ana Kontrol Paneli
    │   │   ├── StudyRooms.jsx           # Tarih, Saat Aralığı ve Süre Filtreli Oda Keşif Ekranı
    │   │   ├── ReserveForm.jsx          # 2 Aşamalı Saat Seçimi ve Grup Arkadaşı Davet Sihirbazı
    │   │   ├── MyBookings.jsx           # Aktif/Geçmiş Randevular, Erken Boşaltma ve Davet Yanıtlama
    │   │   ├── Kiosk.jsx                # A4 Kapı QR Posteri (Yetkili) & Canlı Yoklama Ekranı (Öğrenci)
    │   │   ├── Profile.jsx              # Azure AD Fotoğraf Senkronizasyonu ve Acil Durum Telefonu
    │   │   └── AdminPanel.jsx           # 6 Sekmeli Ana Yönetim Orkestratörü
    │   ├── utils/
    │   │   ├── dateUtils.js             # Tarayıcıdan Bağımsız Türkiye Saati (Europe/Istanbul) Motoru
    │   │   └── formatTime.js            # TR/EN Göreceli Zaman Formatlayıcısı
    │   ├── api.js                       # WebGL GPU Parmak İzi ve Ağ Tipi Enjekte Eden Axios İstemcisi
    │   ├── i18n.js                      # %100 Türkçe ve İngilizce Çeviri Sözlüğü
    │   └── theme.js                     # THKÜ Kurumsal Renk Paleti (#C8102E & #0F172A) ve A4 Print Stilleri
    └── docs/                            # 21 Frontend Dosyasının Bileşen Düzeyinde Teknik Dokümanı
```

---

##  3. Hızlı Kurulum ve Çalıştırma Rehberi (Getting Started)

Projeyi yerel geliştirme ortamında (Localhost) ayağa kaldırmak için **Docker Desktop** ve **Node.js (v18+)** yüklü olmalıdır.

### Adım 1: Depoyu Klonlayın ve Veritabanı Konteynerlerini Başlatın
```bash
git clone https://github.com/boraavcu/thku-library-reservation.git
cd thku-library-reservation

# PostgreSQL (Port: 5433) ve Redis (Port: 6379) servislerini başlatın
docker compose up -d
```

### Adım 2: Ortam Değişkenlerini (`.env`) Yapılandırın
`backend/.env` dosyasını aşağıdaki şablona göre oluşturun:

```env
# 1. Veritabanı ve Redis
DATABASE_URL="postgresql://admin:admin@localhost:5433/library_reservation_db?schema=public"
REDIS_URL="redis://localhost:6379"

# 2. NextAuth ve Frontend Bağlantısı
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="thku-library-super-secret-jwt-key-2026"
FRONTEND_URL="http://localhost:5173"
ENABLE_DEMO_LOGIN="true"

# 3. Microsoft Entra ID (Azure AD) Kurumsal SSO (Canlı Ortam İçin)
AZURE_AD_CLIENT_ID="placeholder-client-id"
AZURE_AD_CLIENT_SECRET="placeholder-secret"
AZURE_AD_TENANT_ID="placeholder-tenant-id"

# 4. Fiziksel Kiosk Güvenlik Parametreleri
LIBRARY_LAT="39.9458257845895"
LIBRARY_LNG="32.69035341292343"
LIBRARY_RADIUS_METERS="1000"
ENFORCE_CAMPUS_GPS="true"
ENFORCE_CAMPUS_WIFI="false"
CAMPUS_IP_PREFIX="193.255."
CAMPUS_VPN_PREFIX="10.254."

# 5. Kurumsal SMTP E-Posta Ayarları (Opsiyonel - Tanımlanmazsa EmailQueue'ya kaydedilir)
SMTP_HOST="mail.thk.edu.tr"
SMTP_PORT="587"
SMTP_USER="kutuphane@thk.edu.tr"
SMTP_PASS=""
DIRECTOR_EMAIL="boraa-35@hotmail.com"
```

İsteğe bağlı olarak `frontend/.env` dosyası oluşturabilirsiniz (varsayılan olarak demo giriş açıktır):
```env
VITE_ENABLE_DEMO_LOGIN="true"
```

### Adım 3: Backend'i ve Başlangıç Verilerini (Seed) Hazırlayın
```bash
cd backend
npm install

# Prisma şemasını PostgreSQL'e uygulayın ve zengin demo verilerini yükleyin
npx prisma migrate deploy
node prisma/seed.cjs

# Backend API sunucusunu başlatın (http://localhost:3000)
npm run dev
```

### Adım 4: Frontend Uygulamasını Başlatın
Yeni bir terminal sekmesi açarak:
```bash
cd frontend
npm install

# Vite geliştirme sunucusunu başlatın (http://localhost:5173)
npm run dev
```
Tarayıcınızdan **`http://localhost:5173`** adresine giderek sistemi hemen kullanmaya başlayabilirsiniz.

---

##  4. Rol Hiyerarşisi ve Hazır Demo Hesapları (`seed.cjs`)

Giriş ekranındaki **"Demo Hızlı Giriş (Güvenli Mail Modu)"** panelinden tek tıkla aşağıdaki gerçekçi senaryoları test edebilirsiniz:

| Rol | E-Posta Adresi | Yetki ve Senaryo Özeti |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | `bim@thk.edu.tr` | **Bilgi İşlem Müdürlüğü:** Tüm sistem, rol atama (`ADMIN` dahil), dinamik kurallar, sözleşme versiyonlama ve 180 günlük denetim logları. |
| **`ADMIN`** | `boraa-35@hotmail.com` | **Kütüphane Müdürü:** Analitik ısı haritası, A4 PDF rapor çıktısı, oda/duyuru/kural yönetimi, kullanıcı banlama ve `LIBRARIAN` yetkisi verme. |
| **`LIBRARIAN`** | `gorevli@thk.edu.tr` | **Kütüphane Görevlisi:** Günlük operasyon takibi, canlı rezervasyonları zorla onaylama (`FORCE_CONFIRM`), `NO_SHOW` işaretleme ve A4 Kapı QR Posteri yazdırma. |
| **`STUDENT` (Aktif)** | `s250444902@stu.thk.edu.tr` | **Bora Avcu (Yazılım Müh.):** Bugün için onaylı (`CONFIRMED`) randevusu bulunan, kapı QR okutmaya hazır gerçek test öğrencisi. |
| **`STUDENT` (Davetli)** | `s220101001@demo.local` | **Ahmet Yılmaz (Bilgisayar Müh.):** Bekleyen (`PENDING`) grup daveti olan ve `1/3 No-Show` uyarısı bulunan öğrenci. |
| **`STUDENT` (Riskli)** | `s220101005@demo.local` | **Caner Aydın (Makine Müh.):** `2/3 No-Show` sınırında olan (bir kez daha gelmezse 30 gün otomatik banlanacak) öğrenci. |
| **`STUDENT` (Banlı)** | `s220101008@demo.local` | **Selin Doğan (Endüstri Müh.):** `3/3 No-Show` nedeniyle 30 gün boyunca sistemden otomatik uzaklaştırılmış öğrenci. |

---

##  5. Kapsamlı Teknik Dokümantasyon İndeksi (50 Modül)

Projedeki her bir kaynak kod dosyasının iş mantığı, güvenlik kontrolleri ve bağımlılıkları `# Context:` standardında ayrı ayrı belgelendirilmiştir:

- **Genel Mimari Rehberler:**
  - [🇹🇷 Kurumsal Sistem Mimarisi ve Mühendislik Dokümantasyonu (TR)](https://www.google.com/search?q=./docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md)
  - [🇬🇧 Enterprise System Architecture \& Engineering Documentation (EN)](https://www.google.com/search?q=./docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md)
- **Bileşen Düzeyinde Kod Dokümanları:**
  - [📘 Backend Teknik Dokümantasyon Rehberi (backend/docs/ — 29 Dosya)](https://www.google.com/search?q=./backend/docs/README.md)
  - [📗 Frontend Teknik Dokümantasyon Rehberi (frontend/docs/ — 21 Dosya)](https://www.google.com/search?q=./frontend/docs/README.md)

---

© 2026 **Türk Hava Kurumu Üniversitesi** — Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü | Geliştirici: **Bora Avcu**
