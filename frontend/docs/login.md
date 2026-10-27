# Context: Login.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`Login.jsx`, uygulamanın kök dizininde (`/`) çalışan kurumsal kimlik doğrulama ve giriş kapısıdır. Öğrencilerin ve personelin kurumsal Microsoft (Azure AD) hesaplarıyla tek tıkla güvenli giriş yapmasını sağlar; ayrıca test ve sunum aşamaları için `.env` kontrollü **"Demo Hızlı Giriş (Güvenli Mail Modu)"** panelini barındırır.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Kimlik Doğrulama:** `next-auth/react` (`signIn`) 
- **Çoklu Dil (i18n):** `react-i18next` (Sağ üst köşede anlık `TR` / `EN` dil değiştirme butonu) 

##  3. İş Mantığı, SSO Entegrasyonu ve Demo Güvenlik Mimarisi

### A. Microsoft Azure AD Kurumsal Giriş (`signIn('azure-ad')`)
- Ana giriş butonu `signIn('azure-ad', { callbackUrl: `${window.location.origin}/dashboard` })` fonksiyonunu tetikler.
- Yalnızca üniversitenin kurumsal Microsoft hesaplarına (`@stu.thk.edu.tr` ve `@thk.edu.tr`) izin verilir.

### B. Ortam Değişkeni Kontrollü Demo Giriş Paneli (`VITE_ENABLE_DEMO_LOGIN`)
- Test sunucusunda ve jüri/müdürlük sunumlarında tüm senaryoların (grup daveti, 2.kişi onayı, 3/3 No-Show ban testi, görevli ve müdür ekranları) şifre girmeden saniyeler içinde test edilebilmesi için `DEMO_ACCOUNTS` dizisi tanımlanmıştır:
  - **Öğrenci 1 (`s250444902@stu.thk.edu.tr`):** Gerçek e-posta bildirimlerini test etmek için kullanılan ana öğrenci hesabı.
  - **Öğrenci 2 – 7 (`@demo.local`):** Sahte e-posta üretmeyen güvenli grup katılımcıları ve `30 ceza puanıyla` sınırda olan (`Caner Aydın`) test öğrencileri.
  - **Yetkili Hesapları:** `LIBRARIAN` (`gorevli.demo@demo.local`), `ADMIN` (`boraa-35@hotmail.com` - gerçek müdür bildirim e-postası alıcısı) ve `SUPER_ADMIN` (`bim.demo@demo.local`).
- **Canlıya (Production) Geçiş Kilidi:** Bu bölüm `import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false'` koşuluna bağlıdır . Canlı ortamda `.env` dosyasında bu değer `false` yapıldığında tek satır kod silmeye gerek kalmadan tüm demo butonları arayüzden kalkar.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/auth/[...nextauth]/route.js` (`azure-ad` ve `demo-login` sağlayıcıları) 
- `frontend/src/i18n.js` 