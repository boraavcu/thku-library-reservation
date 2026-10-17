# Context: Accept Rules API Route (backend/src/app/api/accept-rules/route.js)

## 📌 1. Dosyanın Amacı ve Rolü

Bu API rotası, "THK University Kütüphane Rezervasyon Sistemi"nde yeni kayıt olan veya güncel kütüphane kurallarını henüz onaylamamış kullanıcıların **sözleşme onayını veritabanına işleyen** tek uç noktadır. Frontend'deki `RulesAcceptance.jsx` bileşeni tarafından sadece `POST` metodu ile tetiklenir.

## 🛠 2. Teknoloji Yığını ve Mimarisi

- **Framework:** Next.js 14+ App Router API Route (`app/api/.../route.js`)
- **Kimlik Doğrulama (Server-Side):** `getServerSession(authOptions)` (NextAuth.js)
- **Veritabanı ORM:** Prisma Client (`@/lib/db`)
- **Response Formatı:** `NextResponse.json()`

## 🧠 3. İş Mantığı ve Güvenlik Akışı (Business Logic & Security)

Bu dosya, güvenlik açısından "Zero Trust" (Sıfır Güven) mimarisiyle yazılmıştır. Frontend'den gelen hiçbir veriye (payload) güvenilmez; işlem tamamen sunucu tarafındaki oturum (session) üzerinden yürütülür.

### A. Sunucu Taraflı Oturum Kontrolü (Server-Side Auth Guard)

- İstek geldiğinde `getServerSession(authOptions)` ile isteği atan kişinin gerçekten giriş yapıp yapmadığı kontrol edilir.
- **Kritik Güvenlik Kararı:** Frontend'den `request.json()` ile kullanıcının email adresi veya ID'si İSTENMEZ. Kötü niyetli bir kullanıcı API'ye dışarıdan post atıp başkasının email'ini göndererek onun yerine kural onaylayamasın diye, güncelleme işlemi SADECE token içindeki güvenilir `session.user.email` kullanılarak yapılır.

### B. Veritabanı Güncellemesi (Prisma Mutation)

- Oturum doğrulandıktan sonra Prisma `update` metodu ile veritabanındaki kullanıcının `hasAcceptedRules` sütunu `true` olarak güncellenir.
- İşlem başarılı olursa `{ success: true }` döner.
- **Not:** Bu API sadece veritabanını günceller. Frontend'deki (istemci) Session verisinin güncellenmesi işi, bu API başarılı döndükten sonra `RulesAcceptance.jsx` içindeki NextAuth `update()` fonksiyonu ile yapılır.

## ⚠️ 4. Cursor / AI İçin Geliştirme Kuralları (Strict Constraints)

1. **Güvenlik İhlali Yapma (No Client Trust):** Bu dosyada değişiklik yaparken (Örneğin gelecekte loglama eklerken vs.) işlemi yapacak kullanıcının kimliğini ASLA `request.json()` üzerinden okuma. Daima `session.user.email` veya `session.user.id` kullan.
2. **getServerSession Zorunluluğu:** Next.js backend rotalarında oturum kontrolü için `useSession` KULLANILAMAZ. Her zaman `getServerSession(authOptions)` kullanılmaya devam edilmelidir. `authOptions` importunun bozulmamasına dikkat edilmelidir.
3. **Hata Yönetimi (Try/Catch):** Veritabanı işlemi (`prisma.user.update`) daima `try/catch` bloğu içinde olmalıdır. Hata durumunda sistem `500 Internal Server Error` dönmelidir. Hata detayları güvenlik gereği frontend'e sızdırılmamalı, sadece sunucu konsoluna (`console.error`) yazdırılmalıdır.
