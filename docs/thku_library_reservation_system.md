# Context: THK University Library Reservation System

## 📌 1. Proje Özeti (Project Overview)

Bu proje, Türk Hava Kurumu (THK) Üniversitesi öğrencileri ve personeli için geliştirilmiş kapsamlı bir **Kütüphane Çalışma Odası Rezervasyon Sistemi**dir.
Kullanıcıların Microsoft Azure AD hesaplarıyla (okul e-postaları) güvenli giriş yapabildiği, aktif rezervasyonlarını yönetebildiği, check-in yapabildiği ve kural/ceza sistemiyle desteklenen modern bir web uygulamasıdır.

## 🛠 2. Teknoloji Yığını (Tech Stack)

Proje modern, ölçeklenebilir ve Full-Stack bir JavaScript/TypeScript mimarisi üzerine inşa edilmiştir.

- **Frontend:** React.js / Next.js (App/Pages Router entegre yapı)
- **UI Framework:** Material-UI (MUI v5)
- **Styling:** Özel `theme.js` yapılandırması (Hardcoded CSS veya Tailwind yerine MUI Theme Provider kullanılır).
- **Backend / API:** Next.js API Routes (`/api/...`)
- **Veritabanı:** PostgreSQL
- **ORM:** Prisma v5.22 (Standart Binary Engine kullanılmaktadır. Driver Adapters kullanılmaz).
- **Authentication:** `next-auth` (Sadece `azure-ad` OAuth provider aktiftir, şifreli giriş yoktur).

## 🧠 3. Temel İş Mantığı ve Akışlar (Core Workflows)

### A. Kimlik Doğrulama ve Yönlendirme (Auth Flow)

1. **Login:** Kullanıcı sistemi açtığında `Login.jsx` ekranıyla karşılaşır. "Microsoft ile Giriş Yap" butonu `next-auth` üzerinden Azure AD'yi tetikler.
2. **Kural Onayı (Middleware):** Sisteme ilk kez giren (veya kurallar güncellendiğinde) kullanıcılar, Dashboard'a erişmeden önce zorunlu olarak `RulesAcceptance.jsx` sayfasına yönlendirilir.
3. **Dashboard:** Kuralları onaylayan kullanıcı ana `Dashboard.jsx` ekranına ulaşır.

### B. Rezervasyon ve Ceza Sistemi (Business Logic)

- **Check-in:** Kullanıcılar rezerve ettikleri odaya gittiklerinde sistem üzerinden (veya QR kod ile) "Check-in" yapmalıdır.
- **Ceza Puanı (Penalty):** Check-in yapmayan (No-Show) veya geç iptal eden kullanıcılara sistem otomatik olarak ceza puanı işler (`PenaltyHistory`). Belirli bir puanı aşan kullanıcılar sistemden geçici olarak banlanır (`isBanned`, `banUntil`).
- **Roller (Roles):** Sistemde `STUDENT`, `ADMIN`, `LIBRARIAN` ve `SUPER_ADMIN` rolleri bulunur.

## 🗄 4. Veritabanı Mimarisi (Prisma Schema Summary)

Sistemdeki ana veri modelleri şunlardır:

- **`User`:** Kullanıcı bilgileri, rolü, ceza puanları, ban durumu ve NextAuth ilişkileri.
- **`Room`:** Kütüphanedeki odalar (Örn: R101, Kapasite: 7, Aktiflik durumu).
- **`Reservation`:** Kullanıcı ile Oda arasındaki ilişki. Tarih, saat, katılımcı sayısı ve durum (`PENDING`, `CONFIRMED`, `CHECKED_IN`, vb.) tutulur.
- **`PenaltyHistory`:** Kullanıcıların aldığı cezaların loglandığı tablo.
- **`Announcement`:** Dashboard'da gösterilen sistem duyuruları.
- **`SystemSetting` & `ReservationRule`:** Sistemin dinamik ayarlarının ve rezervasyon limitlerinin tutulduğu tablolar.
- Diğer Tablolar: `AuditLog`, `DashboardStats`, `EmailQueue`, vb.

_(Not: Prisma Client başlatılırken ekstra bir pool/adapter kullanılmaz, doğrudan standart `new PrismaClient()` çağrılır.)_

## 🎨 5. Tasarım ve Geliştirme Kuralları (Cursor & AI Guidelines)

Cursor veya herhangi bir AI asistanı bu projede kod yazarken **AŞAĞIDAKİ KURALLARA KESİNLİKLE UYMALIDIR:**

1. **MUI İlkeleri (Strict MUI):** - Yeni bir bileşen oluşturulurken `div`, `span` veya standart CSS class'ları yerine MUI'nin `Box`, `Typography`, `Grid`, `Stack`, `Paper` bileşenleri kullanılacaktır.
   - `sx` prop'u üzerinden styling yapılacaktır.
2. **Tema Entegrasyonu (Theme-First):**
   - Renkler kesinlikle hardcoded yazılamaz (Örn: `#137fec` YASAK).
   - Bunun yerine `theme.palette.primary.main`, `theme.palette.background.default`, `theme.palette.text.secondary` gibi theme objesinden beslenilmelidir.
3. **Responsive Grid:**
   - Ekran tasarımları Mobile-First ancak Tablet (Landscape) ve Masaüstü uyumlu olmalıdır.
   - Sayfa düzenleri `<Grid container spacing={3}>` ile kurulmalı, kolonlar `xs={12} md={8}` (Sol içerik) ve `xs={12} md={4}` (Sağ Sidebar) mantığıyla oturtulmalıdır.
4. **Veri Yönetimi (No Mock Data in Prod):**
   - UI tasarlanırken mock (sahte) veri kullanılabilir, ancak nihai kodda veriler her zaman `api.get()` veya `api.post()` ile backend'den çekilecek şekilde `useEffect` ve `useState` mimarisine uygun yazılmalıdır.
5. **Güvenlik (Session):**
   - Kullanıcı yetkisi gerektiren her sayfanın en üstünde `useSession()` kontrolü (`status === "loading"` ve `status === "unauthenticated"`) mutlaka bulunmalıdır.
-------------------------------------------------------------------------

Bu sürümde Microsoft Azure AD entegrasyonu temel seviyede yapılandırılmıştır.
Kimlik doğrulama işlemleri için gerekli olan .env ortam değişkenleri aşağıdaki gibi tanımlanmıştır:
//
   AZURE_AD_CLIENT_ID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   AZURE_AD_CLIENT_SECRET=XXXXXXXXXXXXXXX
   AZURE_AD_TENANT_ID=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=XXXXXXXXXXXXXXX

-------------------------------------------------------------------------

📌 v2 - Kurumsal Güncelleme ve Güvenlik İyileştirmesi

Hazırlayan: Funda Yılmaz | Bilgi İşlem Müdürlüğü - Yazılım Geliştirme Uzmanı

⚠️ Notlar:
Bu yapı geliştirme (development) ortamı için hazırlanmıştır.
Secret (istemci gizli anahtarı) belirli bir süre sonra expire (süresi dolacak) şekilde oluşturulmuştur.
Secret değeri yalnızca oluşturulma anında görüntülenebilir ve sonradan tekrar erişilemez.
.env dosyası lokal ortamda tutulur, güvenli değildir ve production için önerilmez.
 v2 için ,sistem, kurumsal güvenlik standartlarına uygun hale getirilmelidir.

🔐 Güncellenecek Yapı
Azure AD Client Secret değeri yeniden oluşturulmalı ve güncellenmeli.
Secret değeri .env üzerinden güncellenerek sistem yeniden başlatılmalı
Kimlik doğrulama sistemi aktif olarak Microsoft Azure AD üzerinden çalışmaktadır.
//
   AZURE_AD_CLIENT_ID=<GÜNCEL_CLIENT_ID>
   AZURE_AD_CLIENT_SECRET=<GÜNCEL_SECRET_VALUE>
   AZURE_AD_TENANT_ID=<GÜNCEL_TENANT_ID>
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=<GÜNCEL_SECRET>

🔄 Secret Yönetimi (Önemli)
Azure AD Client Secret süreli olarak oluşturulmaktadır.
Süresi dolmadan önce aşağıdaki işlem yapılmalıdır:
✔ Yapılması Gerekenler:
Azure Portal → App Registration → Certificates & Secrets
Yeni Client Secret oluştur
Yeni secret değeri .env dosyasına eklenir
Backend servisi yeniden başlatılır
Eski secret sistemden kaldırılır
🏢 Kurumsal Öneri (Production Ortamı)

Production ortamında aşağıdaki yöntemler önerilmektedir:

🔐 Azure Key Vault kullanımı
🔐 App Service Application Settings üzerinden secret yönetimi
🔄 Periyodik secret rotation (şifre yenileme politikası)
⚠️ Güvenlik Uyarıları
Secret değerleri asla GitHub / repo içine yazılmamalıdır.
.env dosyası versiyon kontrolüne dahil edilmemelidir.
Secret bilgileri sadece yetkili kişiler tarafından erişilebilir olmalıdır.
🎯 Sonuç

v1 sürümünde temel entegrasyon sağlanmış,
v2 sürümünde ise sistem:

✔ Güvenli
✔ Yönetilebilir
✔ Kurumsal standartlara uygun

hale getirilmiştir.
------------------------------------------------------------------
v3 - Key Vault entegrasyonlu mimari doküman
v3 - Funda Yılmaz | Bilgi İşlem Müdürlüğü - Yazılım Geliştirme Uzmanı
Azure Key Vault Entegrasyonlu Güvenli Konfigürasyon Mimarisi
1. Amaç

Bu sürümde sistemde kullanılan hassas yapılandırma bilgilerinin .env dosyasından çıkarılarak merkezi ve güvenli bir secret yönetim altyapısına taşınması hedeflenmiştir.
Amaç; Azure AD istemci bilgileri, NextAuth secret değeri ve veritabanı bağlantı bilgilerinin güvenli şekilde saklanması, erişim yetkilerinin sınırlandırılması ve secret yenileme süreçlerinin kurumsal hale getirilmesidir.

2. v1 ve v2’deki durum
v1 - Stajyer Ali Berkan Tan
Azure AD entegrasyonu temel seviyede kurulmuştur.
Kimlik doğrulama için gerekli değerler .env dosyasında tutulmuştur.
Secret yönetimi lokal ve manuel yapılmıştır.
v2 - Funda Yılmaz | Bilgi İşlem Müdürlüğü - Yazılım Geliştirme Uzmanı
Azure AD App Registration bilgileri güncellenmiştir.
Yeni Azure Client Secret oluşturulmuştur.
Kimlik doğrulama yapılandırması kurumsal kontrol ile stabilize edilmiştir.
Ancak secret bilgileri hâlâ .env dosyasında tutulmaktadır.
3. v3 hedef mimari

v3 sürümünde aşağıdaki secret değerleri Azure Key Vault içine taşınacaktır:

AZURE_AD_CLIENT_ID
AZURE_AD_CLIENT_SECRET
AZURE_AD_TENANT_ID
NEXTAUTH_SECRET
DATABASE_URL

Bu yapı sayesinde:

Secret değerleri kaynak koddan ayrılır
.env bağımlılığı azaltılır
Secret rotation merkezi şekilde yapılır
Production ortamında güvenlik seviyesi yükseltilir
4. Önerilen mimari yapı
Katmanlar
Frontend
React / Vite tabanlı kullanıcı arayüzü
API çağrılarını backend’e yönlendirir
Backend
Next.js / NextAuth API katmanı
Runtime sırasında gerekli secret değerlerini Key Vault’tan alır
Authentication
Microsoft Entra ID / Azure AD
OAuth 2.0 + OpenID Connect akışı
Secrets Management
Azure Key Vault
Secret değerlerinin merkezi saklanması
Database
PostgreSQL
Prisma ORM
5. Key Vault’ta tutulacak anahtar adları

Önerilen secret adları:

library-reservation-azure-client-id
library-reservation-azure-client-secret
library-reservation-azure-tenant-id
library-reservation-nextauth-secret
library-reservation-database-url
6. Çalışma mantığı
Uygulama açılır
Backend başlarken gerekli secret’ları ortamdan veya Key Vault erişim katmanından alır
NextAuth, Azure AD provider’ını bu değerlerle initialize eder
Kullanıcı Microsoft hesabıyla giriş yapar
Session/JWT imzası NEXTAUTH_SECRET ile üretilir
Prisma DATABASE_URL ile PostgreSQL’e bağlanır
7. Güvenlik kazanımları
Secret’ların kaynak koda yazılması engellenir
Secret sızıntısı riski azaltılır
Ortamlar arası ayrışma sağlanır
Yetkisiz personelin secret erişimi sınırlandırılır
Secret yenileme operasyonu kontrollü hale gelir
8. Secret rotation prosedürü
Azure Key Vault içinde yeni secret oluşturulur
Uygulama yapılandırması yeni secret’a yönlendirilir
Servis yeniden başlatılır veya yeniden deploy edilir
Eski secret devre dışı bırakılır
Erişim logları kontrol edilir
9. Operasyonel öneriler
Production ortamında .env kullanılmamalıdır
Secret değerleri Git repository içine alınmamalıdır
Key Vault erişimi yalnızca yetkili servis kimliklerine verilmelidir
Secret’lar periyodik olarak yenilenmelidir
Authentication callback URL’leri merkezi dokümante edilmelidir
10. Sonuç

v3 ile birlikte sistem:

daha güvenli,
daha sürdürülebilir,
daha kurumsal,
denetlenebilir bir secret yönetim yapısına

kavuşacaktır.