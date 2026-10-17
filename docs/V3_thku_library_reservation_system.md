NextAuth + Azure AD Tam Akış Diyagramı
v2/v3 Teknik Tasarım Dokümanı 
Hazırlayan : Funda YILMAZ - Yazılım Geliştirme Uzmanı
1. Amaç

Bu akış, THK Üniversitesi Kütüphane Çalışma Odası Rezervasyon Sistemi’nde kullanıcıların Microsoft kurumsal hesapları ile güvenli biçimde giriş yapmasını sağlamak amacıyla tasarlanmıştır.
Kimlik doğrulama katmanında NextAuth ve Azure AD (Microsoft Entra ID) kullanılmaktadır.

2. Bileşenler

Sistemde yer alan ana bileşenler aşağıdaki gibidir:

Kullanıcı Tarayıcısı
Frontend Uygulaması (React / Vite)
Backend Uygulaması (Next.js + NextAuth API Routes)
Microsoft Entra ID / Azure AD
PostgreSQL Veritabanı
Prisma ORM
Opsiyonel Session / JWT katmanı
3. Akışın Genel Özeti
Kullanıcı frontend üzerinde “Microsoft ile Giriş Yap” butonuna tıklar.
Frontend isteği backend üzerindeki NextAuth endpoint’ine yönlendirir.
Backend, Azure AD OAuth/OpenID Connect akışını başlatır.
Kullanıcı Microsoft giriş ekranına yönlendirilir.
Kullanıcı kurumsal hesabıyla kimlik doğrulaması yapar.
Azure AD başarılı doğrulama sonrası kullanıcıyı tanımlı callback URL’e geri döndürür.
Backend callback isteğini alır, kullanıcı bilgilerini işler ve session/JWT oluşturur.
Kullanıcı sistem içinde yetkili oturumla işlem yapmaya başlar.
Gerekiyorsa kullanıcı bilgisi veritabanında oluşturulur veya güncellenir.
Kullanıcı dashboard ve rezervasyon ekranlarına yönlendirilir.
4. Detaylı Akış Adımları
Adım 1 — Kullanıcı Giriş Talebi

Kullanıcı frontend giriş ekranında yer alan Microsoft ile Giriş Yap butonuna tıklar.
Frontend uygulaması bu isteği backend üzerindeki NextAuth signin endpoint’ine yönlendirir.

Örnek istek akışı:

Frontend → /api/auth/signin/azure-ad
Adım 2 — NextAuth Provider Başlatma

Backend tarafında NextAuth, Azure AD provider yapılandırmasını kullanarak OAuth/OpenID Connect akışını başlatır.

Bu aşamada aşağıdaki bilgiler kullanılır:

AZURE_AD_CLIENT_ID
AZURE_AD_CLIENT_SECRET
AZURE_AD_TENANT_ID
NEXTAUTH_URL
NEXTAUTH_SECRET
Adım 3 — Azure AD’ye Yönlendirme

Backend, kullanıcıyı Microsoft Entra ID oturum açma sayfasına yönlendirir.
Kullanıcı burada kurumsal hesabını seçer veya giriş bilgilerini girer.

Örnek yönlendirme mantığı:

Backend (NextAuth) → Azure AD Authorization Endpoint
Adım 4 — Kimlik Doğrulama

Azure AD:

kullanıcı adını doğrular
parola veya kurumsal MFA süreçlerini uygular
tenant ve uygulama izinlerini kontrol eder

Doğrulama başarılıysa kullanıcı callback URL’e döndürülür.

Adım 5 — Callback İşlemi

Azure AD, kullanıcıyı backend üzerindeki callback endpoint’ine yönlendirir:

/api/auth/callback/azure-ad

Bu aşamada backend:

authorization code’u alır
access/id token değişimini yapar
kullanıcı profil bilgilerini çözümler
Adım 6 — Session / JWT Oluşturma

NextAuth, kullanıcı için oturum bilgisini oluşturur.
Bu oturum:

JWT tabanlı olabilir
veya veritabanı destekli session modeli ile çalışabilir

Oluşturulan session bilgisi NEXTAUTH_SECRET ile imzalanır.
Bu nedenle NEXTAUTH_SECRET değeri güvenlik açısından zorunludur.

Adım 7 — Kullanıcı Bilgisinin İşlenmesi

Sistem tasarımına bağlı olarak backend aşağıdaki işlemleri yapabilir:

Kullanıcı veritabanında yoksa User tablosuna yeni kayıt açmak
Kullanıcı varsa son giriş tarihini güncellemek
Kullanıcı rolünü (STUDENT, ADMIN, LIBRARIAN, SUPER_ADMIN) belirlemek
Kuralları kabul durumu, ban durumu ve ceza puanını kontrol etmek
Adım 8 — Yetkilendirme ve Yönlendirme

Kullanıcı giriş yaptıktan sonra:

Kuralları henüz kabul etmemişse RulesAcceptance ekranına yönlendirilir
Kuralları kabul etmişse Dashboard ekranına yönlendirilir
Banlıysa sisteme erişimi engellenebilir
Yetkisine göre admin veya kullanıcı panelleri açılabilir.

5. Mantıksal Akış Diyagramı

[Kullanıcı]
    |
    v
[Frontend Login Ekranı]
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
[Microsoft Entra ID / Azure AD Login]
    |
    v
[Başarılı Kimlik Doğrulama]
    |
    v
[Backend /api/auth/callback/azure-ad]
    |
    v
[NextAuth Session/JWT Oluşturma]
    |
    +----------------------+
    |                      |
    v                      v
[Prisma / PostgreSQL]   [Session Cookie/JWT]
    |                      |
    +----------+-----------+
               |
               v
      [Kurallar / Rol / Ban Kontrolü]
               |
               v
       [Dashboard veya RulesAcceptance]

6. Kullanılan Kritik Yapılandırma Alanları

        NEXTAUTH_URL=http://localhost:3000
        NEXTAUTH_SECRET=<KRIPTOGRAFIK_GIZLI_ANAHTAR>

        AZURE_AD_CLIENT_ID=<APPLICATION_CLIENT_ID>
        AZURE_AD_CLIENT_SECRET=<AZURE_SECRET_VALUE>
        AZURE_AD_TENANT_ID=<DIRECTORY_TENANT_ID>

Ek olarak veritabanı gerekiyorsa:
        DATABASE_URL=<POSTGRESQL_CONNECTION_STRING>

7. Güvenlik Notları
7.1 NEXTAUTH_SECRET

NextAuth tarafından session/JWT imzalamak için kullanılır.
Eksik olması durumunda güvenlik uyarıları oluşur ve oturum yönetimi zayıflar.

7.2 AZURE_AD_CLIENT_SECRET

Azure AD tarafında uygulamanın kimliğini ispatlamak için kullanılır.
Bu değer yalnızca oluşturulurken tam görünür ve güvenli şekilde saklanmalıdır.

7.3 Redirect URI

Azure Portal’da tanımlanan callback URL ile backend tarafındaki callback endpoint birebir eşleşmelidir.

Örnek:
    http://localhost:3000/api/auth/callback/azure-ad

7.4 Secret Yönetimi

Development ortamında .env kullanılabilir.
Production ortamında aşağıdaki yöntemler önerilir:

Azure Key Vault
App Service Configuration
Managed Identity tabanlı erişim
8. Olası Hata Senaryoları
8.1 AADSTS90112: Application identifier is expected to be a GUID

Sebep:

AZURE_AD_CLIENT_ID yanlış girilmiştir
placeholder değer bırakılmıştır
8.2 NO_SECRET

Sebep:

NEXTAUTH_SECRET tanımlanmamıştır
8.3 OAuthSignin

Sebep:

Azure client bilgileri yanlış
callback URI eksik
tenant ID yanlış
client secret süresi dolmuş
8.4 Veritabanı Hataları

Sebep:

DATABASE_URL eksik veya yanlış
Prisma client generate edilmemiş
PostgreSQL bağlantı bilgileri hatalı
9. Sonuç

Bu mimari ile sistem:

Microsoft kurumsal kimlik doğrulamasını kullanır
NextAuth ile oturum yönetimini güvenli hale getirir
Kullanıcı rol ve kurallarını veritabanı üzerinden kontrol eder
Giriş sonrası dashboard, rezervasyon ve ceza akışlarını yönetir

Bu yapı, üniversite içi kullanıcı girişlerinin merkezi ve güvenli şekilde yönetilmesi için uygun bir temel sunmaktadır.