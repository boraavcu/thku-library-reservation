# Context: profile/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/profile/route.js`, kullanıcının kendi profil bilgilerini görüntülemesini (`GET`) ve acil durum telefon numarasını doğrulamalı olarak güncellemesini (`PATCH`) sağlayan uç noktadır.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Kimlik Doğrulama:** `next-auth` (`getServerSession`, `authOptions`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client)

##  3. İş Mantığı ve Telefon Format Doğrulaması (`PHONE_REGEX`)

1. **`GET` Metodu:**
   - Oturum açmış kullanıcının `id`, `fullName`, `email`, `studentNumber`, `department`, `phone`, `avatarUrl`, `role`, `penaltyPoints`, `isBanned` ve `createdAt` bilgilerini veritabanından çekip döndürür.
2. **`PATCH` Metodu ve `PHONE_REGEX` Kontrolü:**
   - Kullanıcının girdiği telefon numarasını `/^\+?[\d\s\-()]{10,15}$/` düzenli ifadesiyle (`PHONE_REGEX`) kontrol eder.
   - Format geçersizse `400 Bad Request` döndürür; geçerliyse `prisma.user.update` ile `phone` alanını günceller. Güncellenen telefon numarası anında Yönetim Panelindeki (`AdminPanel.jsx`) rezervasyon ve öğrenci kartlarına yansır.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Profile.jsx`
- `frontend/src/pages/AdminPanel.jsx`