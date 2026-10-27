# Context: agreements/active/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/agreements/active/route.js`, veritabanında yürürlükte olan (`isActive: true`) en güncel **Kütüphane Kullanım Kuralları Sözleşmesini** (`v1.0` vb.) `RulesAcceptance.jsx` ekranına ileten uç noktadır (`GET`).

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client)

##  3. İş Mantığı

- `prisma.agreement.findFirst({ where: { isActive: true }, orderBy: { createdAt: "desc" } })` sorgusuyla aktif sözleşmenin `id`, `title`, `content`, `version` ve `createdAt` alanlarını çeker.
- Eğer veritabanında henüz aktif bir sözleşme yoksa `404 Not Found` döndürür.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/RulesAcceptance.jsx`
- `backend/src/app/api/user/accept-rules/route.js`
- `backend/src/middleware/checkRulesAcceptance.js`