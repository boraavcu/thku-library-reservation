# Context: user/accept-rules/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/user/accept-rules/route.js`, kullanıcının `RulesAcceptance.jsx` sayfasındaki kullanım kurallarını okuyup **"Anlıyorum ve Devam Et"** butonuna bastığında onay bilgisini veritabanına mühürleyen uç noktadır (`POST`).

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Kimlik Doğrulama:** `next-auth` (`getServerSession`, `authOptions`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client)

##  3. İş Mantığı

1. `getServerSession(authOptions)` ile oturum doğrulaması yapar.
2. `Agreement` tablosundaki aktif sözleşmeyi (`isActive: true`) bulur.
3. `prisma.user.update` ile kullanıcının `acceptedAgreementVersion` alanına aktif sözleşmenin versiyon kodunu (`"v1.0"`) yazar ve istemciye `{ success: true, acceptedAgreementVersion }` yanıtını döndürür.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/RulesAcceptance.jsx`
- `backend/src/middleware/checkRulesAcceptance.js`
- `backend/src/app/api/auth/[...nextauth]/route.js`