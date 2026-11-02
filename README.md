<div align="center">

# THKÜ 7/24 Kütüphane Grup Çalışma Odaları<br/>Rezervasyon ve Kiosk Yoklama Sistemi

<p align="center">
  <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> standartlarında geliştirilmiş;<br/>
  <b>Microsoft Entra ID (Azure AD) SSO</b>, <b>4 Katmanlı Fiziksel Kiosk Kapı QR Güvenliği</b>, <b>Adil No-Show Ceza Motoru</b> ve <b>Canlı Yoğunluk Analitiği</b> barındıran tam otonom Full-Stack Rezervasyon Platformu.
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Backend-Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/Frontend-React_19_%2B_Vite_7-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://mui.com/"><img src="https://img.shields.io/badge/UI-Material_UI_v7-007FFF?style=for-the-badge&logo=mui&logoColor=white" alt="MUI v7" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/DB-PostgreSQL_16_%2B_Prisma-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16" /></a>
  <br/>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Cache_%26_OTP-Redis_(ioredis)-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="https://next-auth.js.org/"><img src="https://img.shields.io/badge/SSO-Microsoft_Entra_ID-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white" alt="Azure AD" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Dil_Deste%C4%9Fi-TR_%7C_EN_(%25100)-C8102E?style=for-the-badge&logo=googletranslate&logoColor=white" alt="TR | EN" /></a>
</p>

<hr/>

<p align="center">
  <a href="./docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md"><img src="https://img.shields.io/badge/%F0%9F%93%91_Sistem_Mimarisi-T%C3%BCrk%C3%A7e_(TR)-0F172A?style=flat-square" alt="Sistem Mimarisi TR" /></a>
  <a href="./docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md"><img src="https://img.shields.io/badge/%F0%9F%8C%90_System_Architecture-English_(EN)-0F172A?style=flat-square" alt="System Architecture EN" /></a>
  <a href="./backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_Dok%C3%BCmanlar%C4%B1-29_Mod%C3%BCl-1E3A8A?style=flat-square" alt="Backend Docs" /></a>
  <a href="./frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_Dok%C3%BCmanlar%C4%B1-21_Mod%C3%BCl-047857?style=flat-square" alt="Frontend Docs" /></a>
</p>

</div>

---

##  1. Projenin Amacı ve Çekirdek Yetenekleri

Üniversite kütüphanelerindeki grup çalışma odalarında sıkça yaşanan **"odayı rezerve edip gelmeme (hayalet rezervasyon)"**, **"tek kişiyle grup odasını kapatma"** ve **"kütüphanede olmadan uzaktan sahte yoklama verme"** sorunlarını ortadan kaldırmak amacıyla **SOLID** prensiplerine uygun olarak tasarlanmıştır:

| Modül / Özellik | Teknik Çözüm ve İş Kuralı Özeti |
| :--- | :--- |
| ** 7/24 Kesintisiz Hizmet & Dinamik Kurallar** | 4 grup çalışma odası (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) 00:00 – 24:00 saatleri arasında hizmet verir. 7 temel kural (`Min/Max Katılımcı`, `Maksimum Süre`, `İleri Tarih Sınırı`, `Sabah Kota Saati`, `Kiosk Toleransı`, `İptal Kilidi`) Yönetim Panelinden canlı olarak değiştirilebilir. |
| ** 4 Katmanlı Fiziksel Kiosk QR Güvenliği** | **1)** Kapıdaki imzalı A4 QR parametresi, **2)** Kampüs Wi-Fi (`eduroam`) doğrulaması ve Hücresel Veri (`4G/5G`) / VPN engeli, **3)** Haversine formülüyle kütüphane merkezli **1000m GPS yarıçapı** kontrolü, **4)** Gizli sekme (Incognito) korumalı **WebGL GPU + Cookie/LocalStorage + Eduroam NAT uyumlu IP/UA** 4 saatlik Redis cihaz kilidi. |
| ** Adil No-Show Cezası & 3/3 Otomatik Ban** | Grup davetleri **30 dk** içinde onaylanmazsa randevu düşer. Başlangıçtan **±15 dk** içinde en az 2 üye kapı QR kodunu okutmazsa oda `NO_SHOW` olur ve anında boşa çıkar. Kapıda QR okutan öğrenciye (`verifiedUsers`) **ceza yazılmaz**; yalnızca gelmeyenlere (`absentUsers`) `1/3` uyarı işlenir. `3/3` olan öğrenci **30 gün** otomatik banlanır. |
| ** Boşa Düşen Odayı Anında Tutma (`Walk-In`)** | İlk grup gelmediği veya `Odayı Erken Boşalt` (`EARLY_CHECKOUT`) yaptığı için ara dakikada (örn. `16:20`'de) boşa düşen bir odayı aynı saat dilimi (`16:00 – 18:00`) için tutan yeni gruba, oluşturulma anından itibaren özel **15 dakikalık (`16:20 – 16:35`)** Kiosk onay penceresi tanımlanır. |

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
│   │   ├── middleware.js                # Edge JWT Rol Güvenlik Duvarı
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
    │   └── theme.js                     # Kurumsal Renk Paleti (#C8102E & #0F172A) ve A4 Print Stilleri
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
Güvenlik nedeniyle gerçek sunucu bilgileri, kampüs IP blokları, koordinatlar ve hesap şifreleri depoda paylaşılmamaktadır. Kurulumu yapan geliştirici veya sistem yöneticisi `backend/.env` dosyasını kendi kurum/yerel değerleriyle oluşturmalıdır:

```env
# 1. Veritabanı ve Redis Bağlantısı (Kendi yerel veya sunucu bağlantı adresinizi girin)
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5433/library_reservation_db?schema=public"
REDIS_URL="redis://localhost:6379"

# 2. NextAuth ve Frontend Bağlantısı (NEXTAUTH_SECRET için: openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<KENDI_GUCLU_JWT_GIZLI_ANAHTARINIZI_OLUSTURUN>"
FRONTEND_URL="http://localhost:5173"
ENABLE_DEMO_LOGIN="true"

# 3. Microsoft Entra ID (Azure AD) Kurumsal SSO (Azure Portal üzerinden kendi uygulama bilgilerinizi girin)
AZURE_AD_CLIENT_ID="<AZURE_AD_CLIENT_ID_DEGERINIZ>"
AZURE_AD_CLIENT_SECRET="<AZURE_AD_CLIENT_SECRET_DEGERINIZ>"
AZURE_AD_TENANT_ID="<AZURE_AD_TENANT_ID_DEGERINIZ>"

# 4. Fiziksel Kiosk Güvenlik Parametreleri (Kendi bina koordinatlarınızı ve kampüs IP bloklarınızı tanımlayın)
LIBRARY_LAT="<KUTUPHANE_ENLEM_KOORDINATI>"
LIBRARY_LNG="<KUTUPHANE_BOYLAM_KOORDINATI>"
LIBRARY_RADIUS_METERS="1000"
ENFORCE_CAMPUS_GPS="true"
ENFORCE_CAMPUS_WIFI="false"
CAMPUS_IP_PREFIX="<KAMPUS_WIFI_IP_ONEKI>"
CAMPUS_VPN_PREFIX="<KURUMSAL_VPN_IP_ONEKI>"

# 5. Kurumsal SMTP E-Posta Ayarları (Kendi SMTP sunucu ve bildirim e-posta adreslerinizi girin)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="example@mail.com"
SMTP_PASS="<SMTP_SIFRENIZ>"
DIRECTOR_EMAIL="example@mail.com"
```

İsteğe bağlı olarak `frontend/.env` dosyası oluşturabilirsiniz (geliştirme ortamında demo girişi kontrol eder):
```env
VITE_ENABLE_DEMO_LOGIN="true"
```

### Adım 3: Backend'i ve Başlangıç Verilerini (Seed) Hazırlayın
```bash
cd backend
npm install

# Prisma şemasını PostgreSQL'e uygulayın ve örnek test verilerini yükleyin
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

##  4. Rol Hiyerarşisi ve Test Senaryosu Hesapları (`seed.cjs`)

Geliştirme modunda (`ENABLE_DEMO_LOGIN="true"`) giriş ekranındaki **Demo Hızlı Giriş** panelinden aşağıdaki rol ve ceza senaryoları test edilebilir:

| Rol | Örnek Hesap | Yetki ve Senaryo Özeti |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | `superadmin@example.com` | **Bilgi İşlem Müdürlüğü:** Tüm sistem, rol atama (`ADMIN` dahil), dinamik kurallar, sözleşme versiyonlama ve 180 günlük denetim logları. |
| **`ADMIN`** | `admin@example.com` | **Kütüphane Müdürü:** Analitik ısı haritası, A4 PDF rapor çıktısı, oda/duyuru/kural yönetimi, kullanıcı banlama ve `LIBRARIAN` yetkisi verme. |
| **`LIBRARIAN`** | `staff@example.com` | **Kütüphane Görevlisi:** Günlük operasyon takibi, canlı rezervasyonları zorla onaylama (`FORCE_CONFIRM`), `NO_SHOW` işaretleme ve A4 Kapı QR Posteri yazdırma. |
| **`STUDENT` (Aktif)** | `student@example.com` | **Bora Avcu (Bilgisayar Müh.):** Bugün için onaylı (`CONFIRMED`) randevusu bulunan, kapı QR okutmaya hazır örnek öğrenci. |
| **`STUDENT` (Davetli)** | `s220101001@demo.local` | **Ahmet Yılmaz (Bilgisayar Müh.):** Bekleyen (`PENDING`) grup daveti olan ve `1/3 No-Show` uyarısı bulunan öğrenci. |
| **`STUDENT` (Riskli)** | `s220101005@demo.local` | **Caner Aydın (Makine Müh.):** `2/3 No-Show` sınırında olan (bir kez daha gelmezse 30 gün otomatik banlanacak) öğrenci. |
| **`STUDENT` (Banlı)** | `s220101008@demo.local` | **Selin Doğan (Endüstri Müh.):** `3/3 No-Show` nedeniyle 30 gün boyunca sistemden otomatik uzaklaştırılmış öğrenci. |

---

##  5. Kapsamlı Teknik Dokümantasyon İndeksi (50 Modül)

Projedeki her bir kaynak kod dosyasının iş mantığı, güvenlik kontrolleri ve bağımlılıkları `# Context:` standardında ayrı ayrı belgelendirilmiştir:

| Doküman Grubu | Kapsam ve İçerik | Dil | Bağlantı |
| :--- | :--- | :---: | :---: |
| **Kurumsal Sistem Mimarisi (TR)** | Uçtan uca mimari vizyon, güvenlik katmanları, veritabanı şeması ve iş akışları | Türkçe | [📄 Dokümanı Aç](./docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md) |
| **Enterprise System Architecture (EN)** | End-to-end system architecture, security layers, database schema & workflows | English | [📄 Open Document](./docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md) |
| **Backend Kod Dokümanları (29 Modül)** | `src/lib/*`, `src/app/api/*`, `middleware`, `schema.prisma` ve `seed.cjs` analizleri | Türkçe | [📘 İndeksi Aç](./backend/docs/README.md) |
| **Frontend Kod Dokümanları (21 Modül)** | `src/pages/*`, `src/components/admin/*`, `src/utils/*`, `api.js` ve `i18n.js` analizleri | Türkçe | [📗 İndeksi Aç](./frontend/docs/README.md) |

---

<div align="center">
  <sub>© 2026 <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> • Geliştirici: <b>Bora Avcu</b></sub>
</div>
