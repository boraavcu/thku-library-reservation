<div align="center">

# THKÜ 7/24 Kütüphane Grup Çalışma Odaları<br/>Rezervasyon ve Kiosk Yoklama Sistemi

<p align="center">
  <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> standartlarında geliştirilmiş;<br/>
  <b>Microsoft Entra ID (Azure AD) SSO</b>, <b>Kurumsal `@thk.edu.tr` Personel Şifre Girişi</b>, <b>PostgreSQL Atomik 4 Katmanlı Kiosk Kapı QR Güvenliği</b>, <b>Adil No-Show Ceza Motoru</b> ve <b>Canlı Yoğunluk Analitiği</b> barındıran tam otonom Full-Stack Rezervasyon Platformu.
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Backend-Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/Frontend-React_19_%2B_Vite_7-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://mui.com/"><img src="https://img.shields.io/badge/UI-Material_UI_v7-007FFF?style=for-the-badge&logo=mui&logoColor=white" alt="MUI v7" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/DB_%26_Locks-PostgreSQL_16_%2B_Prisma-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16" /></a>
  <br/>
  <a href="https://next-auth.js.org/"><img src="https://img.shields.io/badge/Auth-Azure_AD_SSO_%2B_Staff_Scrypt-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white" alt="Auth" /></a>
  <a href="./deploy/README.md"><img src="https://img.shields.io/badge/Deploy-Apache_%2F_randevu_%2B_PM2-7C3AED?style=for-the-badge&logo=apache&logoColor=white" alt="Apache + PM2" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Dil_Deste%C4%9Fi-TR_%7C_EN_(%25100)-C8102E?style=for-the-badge&logo=googletranslate&logoColor=white" alt="TR | EN" /></a>
</p>

<hr/>

<p align="center">
  <a href="./docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md"><img src="https://img.shields.io/badge/%F0%9F%93%91_Sistem_Mimarisi-T%C3%BCrk%C3%A7e_(TR)-0F172A?style=flat-square" alt="Sistem Mimarisi TR" /></a>
  <a href="./docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md"><img src="https://img.shields.io/badge/%F0%9F%8C%90_System_Architecture-English_(EN)-0F172A?style=flat-square" alt="System Architecture EN" /></a>
  <a href="./backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_Dok%C3%BCmanlar%C4%B1-38_Mod%C3%BCl-1E3A8A?style=flat-square" alt="Backend Docs" /></a>
  <a href="./frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_Dok%C3%BCmanlar%C4%B1-24_Mod%C3%BCl-047857?style=flat-square" alt="Frontend Docs" /></a>
  <a href="./deploy/README.md"><img src="https://img.shields.io/badge/%F0%9F%9A%80_Canl%C4%B1_Da%C4%9F%C4%B1t%C4%B1m_Rehberi-Deploy-7C3AED?style=flat-square" alt="Deploy Guide" /></a>
</p>

</div>

---

## 1. Projenin Amacı ve Çekirdek Yetenekleri

Üniversite kütüphanelerindeki grup çalışma odalarında sıkça yaşanan **"odayı rezerve edip gelmeme (hayalet rezervasyon)"**, **"tek kişiyle grup odasını kapatma"** ve **"kütüphanede olmadan uzaktan sahte yoklama verme"** sorunlarını ortadan kaldırmak amacıyla **SOLID** prensiplerine uygun olarak tasarlanmıştır:

| Modül / Özellik | Teknik Çözüm ve İş Kuralı Özeti |
| :--- | :--- |
| **7/24 Kesintisiz Hizmet & Dinamik Kurallar** | 4 grup çalışma odası (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) 00:00 – 24:00 saatleri arasında hizmet verir. 7 temel kural (`Min/Max Katılımcı`, `Maksimum Süre`, `İleri Tarih Sınırı`, `Sabah Kota Saati`, `Kiosk Toleransı`, `İptal Kilidi`) `reservationPolicy.js` üzerinden Yönetim Panelinden canlı olarak değiştirilebilir. |
| **PostgreSQL Atomik 4 Katmanlı Kiosk QR Güvenliği** | Harici Redis gerektirmeden doğrudan PostgreSQL `FOR UPDATE` satır kilitleriyle çalışır: **1)** Kapıdaki imzalı A4 QR parametresi ve giriş sonrası Kiosk dönüş hafızası, **2)** Kampüs Wi-Fi (`eduroam`) doğrulaması ve Hücresel Veri / VPN engeli, **3)** Opsiyonel Haversine **1000m GPS yarıçapı** kontrolü, **4)** Gizli sekme (Incognito) korumalı ve kampüs NAT güvenli **WebGL GPU + Cookie/LocalStorage + IP/UA** 4 saatlik PostgreSQL cihaz kilidi (`kiosk_device_locks`). |
| **Kurumsal `@thk.edu.tr` Personel Şifre Girişi** | Öğrenciler için Microsoft Entra ID SSO yanında kütüphane görevlileri ve yöneticiler için `scrypt` tabanlı kurumsal şifre girişi, 72 saatlik tek gösterimlik geçici şifre, ilk girişte zorunlu şifre değişimi (`mustChangePassword`), `sessionVersion` oturum iptali ve `login_rate_limits` brute-force koruması bulunur. |
| **Adil No-Show Cezası, Otomatik Tamamlama & 3/3 Ban** | Grup davetleri **30 dk** içinde onaylanmazsa randevu düşer. Başlangıçtan **±15 dk** içinde en az 2 üye kapı QR kodunu okutmazsa oda `NO_SHOW` olur ve anında boşa çıkar. Kapıda QR okutan öğrenciye (`kiosk_attendances`) **ceza yazılmaz**; yalnızca gelmeyenlere `1/3` uyarı işlenir, `3/3` olan **30 gün** banlanır. Süresi biten `CONFIRMED` ve `CHECKED_IN` randevular otomatik `COMPLETED` olur. |
| **Boşa Düşen Odayı Anında Tutma (`Walk-In`)** | İlk grup gelmediği veya `Odayı Erken Boşalt` (`EARLY_CHECKOUT`) yaptığı için ara dakikada (örn. `16:20`'de) boşa düşen bir odayı aynı saat dilimi (`16:00 – 18:00`) için tutan yeni gruba, oluşturulma anından itibaren özel **15 dakikalık (`16:20 – 16:35`)** Kiosk onay penceresi tanımlanır. |

---

## 2. Sistem Mimarisi ve Klasör Yapısı (SOLID)

Proje, yüksek bakım kolaylığı ve tek sorumluluk prensibi (**Single Responsibility Principle**) doğrultusunda modüler **Backend**, **Frontend** ve **Deploy** katmanlarına ayrılmıştır:

```text
thku-library-reservation/
├── docker-compose.yaml                  # Yerel geliştirme için PostgreSQL 16 (Port: 5433) konteyneri
├── ecosystem.config.cjs                 # Üretim ortamı PM2 süreç yapılandırması (thku-randevu-api)
├── deploy/                              # Canlı Windows Server + Apache (/randevu) + PM2 dağıtım betikleri
│   ├── apache-randevu.conf              # Apache *:443 VirtualHost /randevu Alias & /randevu/api/ ProxyPass
│   ├── derle.cmd                        # Backend (Next.js) ve Frontend (Vite dist) üretim derleyici
│   ├── migration-uygula.cmd             # Sıfır veri kayıplı Prisma migrate deploy betiği
│   ├── baslat.cmd                       # PM2 servis başlatma ve kaydetme betiği
│   └── README.md                        # Adım adım canlı kurulum ve güncelleme rehberi
├── docs/                                # Kurumsal Sistem Mimarisi Dokümanları (TR & EN)
│   ├── THKU_LIBRARY_RESERVATION_SYSTEM_TR.md
│   └── THKU_LIBRARY_RESERVATION_SYSTEM_EN.md
│
├── backend/                             # Next.js 16 (App Router) Headless API & Otomasyon Sunucusu
│   ├── prisma/
│   │   ├── schema.prisma                # 24 Modelli İlişkisel PostgreSQL Şeması (Kiosk & Staff Auth dahil)
│   │   ├── migrations/                  # 8 Kümülatif SQL Migration Dizini
│   │   └── seed.cjs                     # Zengin Analitik Demo ve Başlangıç Veri Tohumlama Betiği
│   ├── src/
│   │   ├── lib/                         # Çekirdek Servis Katmanı (SOLID)
│   │   │   ├── db.js                    # DATABASE_URL değişim duyarlı Prisma Client Singleton
│   │   │   ├── timeUtils.js             # Merkezi Türkiye Saati (Europe/Istanbul) ve Kiosk Pencere Motoru
│   │   │   ├── publicPaths.js           # /randevu alt dizin uyumlu genel URL üretici
│   │   │   ├── reservationPolicy.js     # 7 Dinamik Kural, Günlük Kota, Gece/Sabah Kuralı ve Ban Politikası
│   │   │   ├── kioskSecurity.js         # 4 Katmanlı GPS, Kampüs Wi-Fi ve NAT Güvenli Cihaz Kilidi Motoru
│   │   │   ├── kioskStore.js & kioskSql.mjs # PostgreSQL FOR UPDATE Kiosk OTP, Yoklama ve Cihaz Kilidi Deposu
│   │   │   ├── staffAccount.js & staffAuth*.mjs # Kurumsal @thk.edu.tr Personel Şifre (scrypt) ve Hesap Servisi
│   │   │   ├── staffMail.js             # Geçici Şifre Bilgilendirme SMTP Göndericisi
│   │   │   ├── loginRateLimit.js        # PostgreSQL Tabanlı E-Posta & IP Brute-Force Koruması
│   │   │   ├── passwordGate.js          # Zorunlu Şifre Değişimi ve Aktif Oturum API Kapısı
│   │   │   ├── testData.js              # @demo.local Test Verilerini Güvenli Temizleme Servisi
│   │   │   ├── emailService.js          # Nodemailer SMTP, EmailQueue ve XSS Korumalı HTML Şablon Motoru
│   │   │   ├── penaltyService.js        # Adil No-Show (1/3 -> 3/3) ve 30 Gün Otomatik Ban Motoru
│   │   │   └── lifecycle.js             # 30 Saniyelik Otonom Zamanlayıcı ve Durum Makinesi
│   │   ├── middleware/
│   │   │   └── checkRulesAcceptance.js  # Aktif Oturum, Şifre Değişimi ve Sözleşme Versiyon Doğrulayıcı
│   │   ├── middleware.js                # Edge JWT Rol Güvenlik Duvarı
│   │   └── app/api/                     # RESTful API Uç Noktaları (18 Route)
│   │       ├── account/password/        # Kurumsal personel zorunlu/isteğe bağlı şifre güncelleme (POST)
│   │       ├── admin/manage/            # route.js (Analitik GET) & handlers.js (İdari Operasyonlar POST)
│   │       ├── auth/[...nextauth]/      # Azure AD SSO, Kurumsal Şifre Girişi, Demo Giriş & Auto-Unban
│   │       ├── kiosk/qr/                # Kiosk Ön Doğrulama, Poster Modu ve 10 Dakikalık OTP Üretimi
│   │       ├── checkin/validate/        # Atomik Kiosk Yoklama Onayı ve 2. Kişide Oda Açılışı
│   │       ├── reservations/            # Randevu Oluşturma (Serializable Tx), Erken Boşaltma ve İptal
│   │       ├── invitations/             # Grup Daveti Listeleme ve Kabul/Red (PENDING -> CONFIRMED)
│   │       ├── rooms/                   # Gerçek Zamanlı Oda ve Saat Dilimi Müsaitlik Sorguları
│   │       └── ...                      # admin/set-role, agreements, announcements, dashboard, profile, reserve, user
│   ├── test/                            # Kiosk Atomiklik ve Kurumsal Şifre Birim Testleri (20 Test)
│   └── docs/                            # 38 Backend Teknik Dokümanı (37 Modül + 1 İndeks)
│
└── frontend/                            # React 19 + Vite 7 + Material-UI v7 İstemci Uygulaması (/randevu/)
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx               # Rol Duyarlı Üst Menü, Şifre Değiştir, Bildirimler ve TR/EN Seçici
    │   │   ├── Footer.jsx               # Kurumsal Alt Bilgi ve Hızlı Bağlantılar
    │   │   ├── PasswordField.jsx        # Göster/Gizle Destekli Erişilebilir Şifre Giriş Bileşeni
    │   │   ├── dashboard/
    │   │   │   └── RoomDensityChart.jsx # 24 Saatlik Oda Yoğunluk Sütun Grafiği
    │   │   └── admin/                   # Modüler Yönetim Paneli Alt Bileşenleri
    │   │       ├── adminConstants.js    # Ortak Renk, Rol, Aksiyon Rozeti ve Yardımcı Sabitler
    │   │       ├── AnalyticsTab.jsx     # Sekme 1: Yoğunluk Isı Haritası, İptal Pasta Grafiği, A4 Rapor
    │   │       ├── ReservationsTab.jsx  # Sekme 2: Canlı Randevu Arama, Manuel Check-In, No-Show, İptal
    │   │       ├── RoomsTab.jsx         # Sekme 3: Oda Ekleme/Düzenleme ve Bakım Modu
    │   │       ├── AnnouncementsTab.jsx # Sekme 4: Çok Dilli (TR/EN) Duyuru Yayınlama Merkezi
    │   │       ├── UsersTab.jsx         # Sekme 5: Ban/Rol, Kurumsal Hesap Açma, Geçici Şifre & Aktif/Pasif
    │   │       └── RulesAndLogsTab.jsx  # Sekme 6: 7 Dinamik Kural, Sözleşme Versiyonlama ve Loglar
    │   ├── pages/                       # Sayfa Bileşenleri (10 Sayfa)
    │   │   ├── Login.jsx                # Microsoft SSO, Kurumsal @thk.edu.tr Şifre Girişi ve Demo Paneli
    │   │   ├── ChangePassword.jsx       # Kurumsal Personel Zorunlu / İsteğe Bağlı Şifre Değiştirme Sayfası
    │   │   ├── RulesAcceptance.jsx      # 6 Maddelik TR/EN Zorunlu Sözleşme Onay Ekranı
    │   │   ├── Dashboard.jsx            # Öğrenci Ana Kontrol Paneli
    │   │   ├── StudyRooms.jsx           # Tarih, Saat Aralığı ve Süre Filtreli Oda Keşif Ekranı
    │   │   ├── ReserveForm.jsx          # 2 Aşamalı Saat Seçimi ve Grup Arkadaşı Davet Sihirbazı
    │   │   ├── MyBookings.jsx           # Aktif/Geçmiş Randevular, Erken Boşaltma ve Davet Yanıtlama
    │   │   ├── Kiosk.jsx                # A4 Kapı QR Posteri (Yetkili) & Canlı Yoklama Ekranı (Öğrenci)
    │   │   ├── Profile.jsx              # Azure AD Fotoğraf Senkronizasyonu ve Acil Durum Telefonu
    │   │   └── AdminPanel.jsx           # 6 Sekmeli Yönetim Orkestratörü & Test Verisi Temizleme
    │   ├── utils/
    │   │   ├── dateUtils.js             # Merkezi Türkiye Saati (Europe/Istanbul) ve Bitiş Kontrol Motoru
    │   │   └── formatTime.js            # TR/EN Göreceli Zaman Formatlayıcısı
    │   ├── runtimePaths.js              # /randevu Alt Dizin, API ve NextAuth Yönlendirme Yardımcıları
    │   ├── api.js                       # WebGL GPU Parmak İzi ve Ağ Tipi Enjekte Eden Axios İstemcisi
    │   ├── i18n.js                      # %100 Türkçe ve İngilizce Çeviri Sözlüğü
    │   └── theme.js                     # Kurumsal Renk Paleti (#C8102E & #0F172A) ve A4 Print Stilleri
    └── docs/                            # 24 Frontend Teknik Dokümanı (23 Modül + 1 İndeks)
```

---

## 3. Hızlı Kurulum ve Çalıştırma Rehberi (Localhost)

Projeyi yerel geliştirme ortamında çalıştırmak için **Docker Desktop** (veya yerel PostgreSQL 16) ve **Node.js (v20+)** yeterlidir; Redis kurulumu gerekmez.

### Adım 1: Depoyu Klonlayın ve PostgreSQL Konteynerini Başlatın
```bash
git clone https://github.com/boraavcu/thku-library-reservation.git
cd thku-library-reservation

# PostgreSQL 16 (Port: 5433) konteynerini başlatın
docker compose up -d
```

### Adım 2: Ortam Değişkenlerini (`.env`) Yapılandırın
`backend/.env` dosyasını oluşturun (gerçek sunucu şifreleri ve gizli anahtarlar `.gitignore` ile korunur ve depoya eklenmez):

```env
# 1. PostgreSQL Bağlantısı
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5433/library_reservation_db?schema=public"

# 2. NextAuth ve Uygulama Adresleri (NEXTAUTH_SECRET için: openssl rand -base64 32)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<KENDI_GUCLU_JWT_GIZLI_ANAHTARINIZI_OLUSTURUN>"
FRONTEND_URL="http://localhost:5173"
ENABLE_DEMO_LOGIN="true"

# 3. Microsoft Entra ID (Azure AD) Kurumsal SSO
AZURE_AD_CLIENT_ID="<AZURE_AD_CLIENT_ID_DEGERINIZ>"
AZURE_AD_CLIENT_SECRET="<AZURE_AD_CLIENT_SECRET_DEGERINIZ>"
AZURE_AD_TENANT_ID="<AZURE_AD_TENANT_ID_DEGERINIZ>"

# 4. Fiziksel Kiosk Güvenlik Parametreleri
LIBRARY_LAT="<KUTUPHANE_ENLEM_KOORDINATI>"
LIBRARY_LNG="<KUTUPHANE_BOYLAM_KOORDINATI>"
LIBRARY_RADIUS_METERS="1000"
ENFORCE_CAMPUS_GPS="false"
ENFORCE_CAMPUS_WIFI="false"
CAMPUS_IP_PREFIX="<KAMPUS_WIFI_IP_ONEKI>"
CAMPUS_VPN_PREFIX="<KURUMSAL_VPN_IP_ONEKI>"

# 5. Kurumsal SMTP E-Posta Ayarları
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="example@mail.com"
SMTP_PASS="<SMTP_SIFRENIZ>"
DIRECTOR_EMAIL="example@mail.com"
```

İsteğe bağlı olarak `frontend/.env` dosyası oluşturabilirsiniz (canlı sunucuda `VITE_ENABLE_DEMO_LOGIN="false"` yapılır):
```env
VITE_ENABLE_DEMO_LOGIN="true"
```

### Adım 3: Backend'i, Veritabanı Şemasını ve Testleri Çalıştırın
```bash
cd backend
npm install

# Prisma istemcisini üretin, tüm migration'ları uygulayın ve demo verilerini yükleyin
npx prisma generate
npx prisma migrate deploy
npm run seed

# İsteğe bağlı: Kiosk atomiklik ve kurumsal şifre testlerini doğrulayın (20/20 test)
npm test

# Backend API sunucusunu başlatın (http://localhost:3000)
npm run dev
```

### Adım 4: Frontend Uygulamasını Başlatın
Yeni bir terminal sekmesi açarak:
```bash
cd frontend
npm install

# Vite geliştirme sunucusunu başlatın (http://localhost:5173/randevu/)
npm run dev
```
Tarayıcınızdan **`http://localhost:5173/randevu/`** adresine giderek sistemi kullanmaya başlayabilirsiniz. Canlı sunucu kurulumu ve güncelleme adımları için [🚀 Canlı Dağıtım Rehberi (`deploy/README.md`)](./deploy/README.md) dokümanını inceleyin.

---

## 4. Rol Hiyerarşisi ve Yetki Özeti

| Rol | Giriş Yöntemi | Yetki ve Sorumluluk Özeti |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Azure AD SSO / `@thk.edu.tr` Şifre | **Bilgi İşlem Müdürlüğü:** Tüm sistem yönetimi, `@thk.edu.tr` kurumsal personel hesabı açma, 72 saatlik geçici şifre üretme/sıfırlama, hesap aktif/pasif yapma, `ADMIN` rolü atama, dinamik kurallar ve `@demo.local` test verilerini temizleme. |
| **`ADMIN`** | Azure AD SSO / `@thk.edu.tr` Şifre | **Kütüphane Müdürü:** 7x24 yoğunluk ısı haritası, A4 PDF faaliyet raporu, oda/duyuru/kural yönetimi, kullanıcı banlama ve `LIBRARIAN` yetkisi verme. |
| **`LIBRARIAN`** | Azure AD SSO / `@thk.edu.tr` Şifre | **Kütüphane Görevlisi:** Günlük canlı rezervasyon takibi, manuel Check-In (`FORCE_CHECKIN`), erken boşaltma, `NO_SHOW` işaretleme ve A4 Kapı QR Posteri yazdırma. |
| **`STUDENT`** | Microsoft Entra ID (`@stu.thk.edu.tr`) | **Öğrenci:** Çalışma odası filtreleme, grup arkadaşı davetli rezervasyon açma, davet yanıtlama, kapıda fiziksel Kiosk QR yoklaması verme ve erken boşaltma. |

---

## 5. Kapsamlı Teknik Dokümantasyon İndeksi

Projedeki tüm kaynak kod dosyaları `# Context:` standardında ayrı ayrı belgelendirilmiştir:

| Doküman Grubu | Kapsam ve İçerik | Dil | Bağlantı |
| :--- | :--- | :---: | :---: |
| **Kurumsal Sistem Mimarisi (TR)** | Uçtan uca mimari vizyon, güvenlik katmanları, 24 modelli şema ve iş akışları | Türkçe | [📄 Dokümanı Aç](./docs/THKU_LIBRARY_RESERVATION_SYSTEM_TR.md) |
| **Enterprise System Architecture (EN)** | End-to-end system architecture, security layers, 24-model schema & workflows | English | [📄 Open Document](./docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md) |
| **Backend Kod Dokümanları (38 Dosya)** | `src/lib/*`, `src/app/api/*`, `middleware`, `schema.prisma`, `seed.cjs` ve `test/*` analizleri | Türkçe | [📘 İndeksi Aç](./backend/docs/README.md) |
| **Frontend Kod Dokümanları (24 Dosya)** | `src/pages/*`, `src/components/*`, `src/utils/*`, `runtimePaths.js`, `api.js` ve `i18n.js` analizleri | Türkçe | [📗 İndeksi Aç](./frontend/docs/README.md) |
| **Canlı Dağıtım & Güncelleme Rehberi** | Windows Server + Apache (`/randevu`) + PM2 (`thku-randevu-api`) kurulum ve güncelleme adımları | Türkçe | [🚀 Rehberi Aç](./deploy/README.md) |

---

<div align="center">
  <sub>© 2026 <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> • Geliştirici: <b>Bora Avcu</b></sub>
</div>
