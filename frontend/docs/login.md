# Context: Login.jsx

## 📌 1. Dosyanın Amacı ve Rolü

`Login.jsx`, "THK University Kütüphane Rezervasyon Sistemi"nin **giriş kapısıdır (Entry Point)**. Kullanıcıların sisteme güvenli bir şekilde giriş yapmasını sağlar. Kendi içinde bir kayıt (sign-up) veya şifre sıfırlama akışı barındırmaz; kimlik doğrulama işlemi tamamen **Microsoft Azure Active Directory (OAuth)** üzerinden yürütülür.

## 🛠 2. Teknoloji Yığını (Tech Stack)

- **UI Framework:** Material-UI (MUI v5)
- **Authentication:** `next-auth/react` (`signIn`, `useSession`)
- **Routing:** `react-router-dom` (`Maps`, `useNavigate`)
- **İkonlar:** `@mui/icons-material` (Microsoft/Kurum logoları için özel SVG'ler veya MUI ikonları)

## 🧠 3. İş Mantığı ve State Yönetimi (Business Logic & State)

Login ekranı, manuel form girişlerinden ziyade oturum durumuna (session status) göre tepki veren reaktif bir yapıdadır:

### A. Oturum Kontrolü ve Otomatik Yönlendirme (Auto-Redirect)

- Bileşen yüklendiğinde `useSession()` kancası ile kullanıcının durumu kontrol edilir.
- **Yükleniyor:** `status === "loading"` ise ekranın merkezinde bir `<CircularProgress />` gösterilir. Form veya buton render edilmez.
- **Zaten Giriş Yapılmış:** `status === "authenticated"` ise, kullanıcı Login ekranını görmemelidir. Anında `<Navigate to="/dashboard" replace />` kullanılarak tarayıcı geçmişinde iz bırakmadan yönlendirilir.

### B. Giriş İşlemi (Sign In Action)

- Kullanıcı "Microsoft ile Giriş Yap" (veya "Kurumsal Giriş") butonuna tıkladığında `signIn('azure-ad')` fonksiyonu tetiklenir.
- Bu işlem kullanıcıyı uygulamanın dışına (Microsoft login sayfasına) çıkarır ve başarılı dönüşte NextAuth callback'leri aracılığıyla oturum başlatılır.

## 📐 4. Layout ve Grid Sistemi (Kritik Kurallar)

Dashboard'un aksine, Login sayfası **tek odaklı (Single Focus)** ve **merkezlenmiş (Centered)** bir tasarıma sahiptir.

- **Ana Taşıyıcı (Wrapper):** Ekranın tamamını kaplamalıdır (`minHeight: '100vh'`). İçerik hem dikeyde hem yatayda tam ortalanmalıdır (`display: 'flex'`, `alignItems: 'center'`, `justifyContent: 'center'`).
- **Giriş Kartı (Login Card):** - Maksimum genişliği sınırlandırılmış (Örn: `maxWidth: 400` veya `xs={11} sm={8} md={4}` grid yapısı) bir `Card` veya `Paper` bileşenidir.
  - İç boşlukları (padding) ferah tutulmalıdır (`p: 4` veya `p: 5`).
  - Hiyerarşi: Üstte üniversite/sistem logosu, altında karşılama metni (Başlık ve Alt Başlık), en altta tam genişlikte (`fullWidth`) Login butonu yer alır.

## 🎨 5. Tasarım ve Tema Kuralları (MUI Constraints)

Projenin genelinde olduğu gibi, Login sayfasında da `theme.js` dosyasına sıkı sıkıya bağlı kalınmalıdır. Hardcoded renk kodları kullanılamaz.

- **Arka Plan:** Sayfanın genel arka planı için `bgcolor: 'background.default'` veya kurumsal bir kimlik katmak istenirse `primary.main` tabanlı hafif bir degrade/şeffaf desen kullanılabilir.
- **Tipografi:** - Karşılama başlığı için belirgin ve kalın bir font (`variant="h5"` veya `h4`, `fontWeight: 700`, `color: 'text.primary'`).
  - Alt metin (Örn: "Kurumsal e-posta adresinizle giriş yapın") için `color: 'text.secondary'`.
- **Buton Tasarımı:**
  - Login butonu ekranın en önemli CTA'i (Call to Action) olduğu için `variant="contained"` ve `size="large"` olmalıdır.
  - Buton rengi `primary.main` olmalı, hover durumunda `primary.dark` veya opacity değişimleriyle tepki vermelidir.
  - Butonun içinde sol tarafta (startIcon) kurumu veya Microsoft'u temsil eden bir ikon bulunmalıdır.

## 🚀 6. Hata Yönetimi ve Gelecek Geliştirmeler (Error Handling & Future)

- **Hata Gösterimi:** Eğer NextAuth üzerinden bir hata dönerse (Örn: URL'de `?error=AccessDenied` parametresi varsa), Login butonunun üst kısmında MUI `<Alert severity="error">` bileşeni ile kullanıcıya "Giriş yapılamadı, yetkiniz olmayabilir" gibi bir mesaj gösterilmelidir.
- **SSO Uyumluluğu:** İleride farklı giriş yöntemleri (Örn: Misafir Öğrenci Girişi) eklenecekse, ana `Card` yapısı bozulmadan altına bir `Divider` eklenerek ikincil butonlar entegre edilmelidir.
