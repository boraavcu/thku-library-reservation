# Context: announcements/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/announcements/route.js`, kütüphane yönetimi tarafından yayınlanan aktif duyuruları Öğrenci Ana Sayfasına (`Dashboard.jsx`) ve üst menüdeki (`Navbar.jsx`) bildirim merkezine ileten uç noktadır (`GET`).

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client)

##  3. İş Mantığı

- `prisma.announcement.findMany` sorgusuyla `isActive: true` olan son 30 duyuruyu yayınlanma tarihine göre en yeniden eskiye doğru (`orderBy: { publishedAt: "desc" }`) çeker.
- Her duyuru nesnesi çok dilli (`{ tr, en }`) `title` ve `content` JSON alanlarını, öncelik derecesini (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), sabitlenme durumunu (`isPinned`) ve yayınlanma zamanını (`publishedAt`) içerir.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/components/Navbar.jsx`
- `backend/src/app/api/admin/manage/route.js` (`CREATE_ANNOUNCEMENT` & `DELETE_ANNOUNCEMENT`)