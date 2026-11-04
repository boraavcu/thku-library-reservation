# Context: announcements/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/announcements/route.js`, kütüphane yönetimi tarafından yayınlanan aktif duyuruları Öğrenci Ana Sayfasına (`Dashboard.jsx`) ve üst menüdeki (`Navbar.jsx`) bildirim merkezine ileten uç noktadır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `Announcement`)

## 3. İş Mantığı (`GET`)

1. **Şifre Kapısı ve Oturum Kontrolü:** `rejectIfPasswordChangeRequired(session)` ile geçici şifre oturumları (`403 PASSWORD_CHANGE_REQUIRED`) ve oturumsuz istekler (`401`) reddedilir.
2. **Aktif ve Süresi Dolmamış Duyuruların Sorgulanması:**
   - `prisma.announcement.findMany` ile `isActive: true`, `publishedAt <= now` ve süresi dolmamış (`expiresAt === null` veya `expiresAt > now`) son 30 duyuruyu yayınlanma tarihine göre (`orderBy: [{ publishedAt: "desc" }]`) çeker.
   - Her duyuru nesnesi çok dilli (`{ tr, en }`) `title` ve `content` JSON alanlarını, öncelik derecesini (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), sabitlenme durumunu (`isPinned`) ve yayınlanma zamanını (`publishedAt`) içerir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx` & `frontend/src/components/Navbar.jsx`
- `backend/src/lib/passwordGate.js`
- `backend/src/app/api/admin/manage/handlers.js` (`CREATE_ANNOUNCEMENT` & `DELETE_ANNOUNCEMENT`)
