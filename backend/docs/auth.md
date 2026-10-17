# Context: NextAuth Route (backend/src/app/api/auth/[...nextauth]/route.js)

## 📌 1. Dosyanın Amacı ve Rolü

Bu dosya, "THK University Kütüphane Rezervasyon Sistemi"nin **Backend Kimlik Doğrulama (Authentication) Merkezidir**. Next.js App Router mimarisinde bir API Route olarak çalışır. Kullanıcıların Azure AD üzerinden giriş yapmasını, veritabanına (PostgreSQL) kaydedilmesini ve oturum (Session/JWT) verilerinin frontend'e (Vite/React - Port 5173) güvenli bir şekilde aktarılmasını sağlar.

## 🛠 2. Teknoloji Yığını ve Mimarisi

- **Framework:** Next.js 14+ App Router (`app/api/auth/[...nextauth]/route.js`)
- **Auth Kütüphanesi:** NextAuth.js v4
- **Provider:** Azure Active Directory (Microsoft Entra ID)
- **Veritabanı ORM:** Prisma Client (`@/lib/db`)
- **Strateji:** JWT (JSON Web Token) tabanlı oturum yönetimi.

## 🧠 3. Kimlik Doğrulama Akışı (İş Mantığı)

Sistem, performansı artırmak ve veritabanı yükünü hafifletmek için **optimize edilmiş bir JWT akışı** kullanır. Cursor bu dosyaya müdahale ederken bu 4 aşamalı akışı kesinlikle bozmamalıdır:

### A. Giriş Yakalama (`signIn` Callback)

- Kullanıcı Microsoft ile giriş yaptığında tetiklenir.
- Gelen Azure AD verisi (email, isim, profil resmi) alınarak Prisma üzerinden veritabanında `upsert` (varsa güncelle, yoksa yeni kayıt oluştur) işlemi yapılır.
- Yeni kullanıcılara varsayılan olarak `role: "STUDENT"` ve `isActive: true` atanır.
- Başarılı olursa süreç devam eder, aksi halde login reddedilir.

### B. Token Zenginleştirme (`jwt` Callback) - 🚀 Performans Odaklı

- Kullanıcı giriş yaptığında (sadece ilk seferde) Prisma'dan kullanıcının güncel detayları (`id`, `role`, `studentNumber`, `avatarUrl`, `hasAcceptedRules`) çekilir ve **JWT token'ın içine gömülür.**
- **Optimizasyon:** Token boyutunu şişirmemek için default Azure payload'undaki `picture` ve `image` alanları silinir.
- **Update Tetikleyicisi:** Frontend'den `update()` çağrıldığında (Örn: Kurallar kabul edildiğinde) token'daki veriler session'dan gelen verilerle güncellenir.

### C. Session Dağıtımı (`session` Callback)

- Frontend `useSession()` veya `getSession()` çağırdığında çalışır.
- **ÖNEMLİ KURAL:** Bu aşamada veritabanına (`prisma.user.findUnique`) KESİNLİKLE sorgu atılmaz. Tüm veriler bir önceki adımda hazırlanan JWT `token` içinden okunarak `session.user` objesine maplenir.

### D. Yönlendirme (`redirect` Callback) - 🌐 Decoupled Mimari

- Projenin frontend'i Next.js içinde değil, ayrı bir portta (`http://localhost:5173` - Vite) çalışmaktadır.
- Bu callback, Azure AD girişinden sonra kullanıcının Next.js backend'inde kalmasını engelleyip, güvenli (allowedFrontend) Vite uygulamasına geri dönmesini sağlar.

## ⚠️ 4. Cursor / AI İçin Geliştirme Kuralları (Strict Constraints)

1. **Veritabanı Yükü:** `session` callback'i içine asla `prisma` sorgusu yazma. Tüm DB işlemleri `signIn` veya `jwt` (ilk girişte) içinde halledilmelidir.
2. **App Router Export:** Bu dosya Pages Router değil, App Router dizinindedir. Export işlemi `export { handler as GET, handler as POST }` şeklinde kalmalıdır.
3. **Session Objeleri:** Frontend tarafında (Dashboard, Rules vs.) kullanıcı verilerine erişilirken her zaman `session.user.id`, `session.user.role`, `session.user.hasAcceptedRules` parametreleri kullanılacaktır. Token'a yeni bir veri eklenecekse hem `jwt` hem de `session` callback'lerine eklenmesi zorunludur.
