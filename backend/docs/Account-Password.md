# Context: account/password/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/account/password/route.js`, kurumsal `@thk.edu.tr` personelinin tek kullanımlık geçici şifreyle yaptığı ilk girişte (veya şifre sıfırlama sonrasında) **kalıcı şifresini belirlediği** özel güvenlik uç noktasıdır (`POST /api/account/password`). Kullanıcı `mustChangePassword === true` durumundayken sistemde erişebildiği tek işlem uç noktasıdır; şifre kaydedildiği anda mevcut geçici oturumu düşürerek kullanıcıyı yeni kalıcı şifresiyle temiz giriş yapmaya yönlendirir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & JWT:** `next-auth` (`getServerSession`, `authOptions`) & `next-auth/jwt` (`getToken`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`)
- **Güvenlik Modülleri:**
  - `@/lib/passwordGate` (`noStoreJson` — `Cache-Control: no-store`)
  - `@/lib/staffAuth.mjs` (`hashPassword`, `verifyPassword`, `validatePasswordPolicy`, `temporaryPasswordStillValid`)

## 3. İş Mantığı ve Güvenlik Kontrolleri (`POST`)

1. **Çift Katmanlı Oturum ve İptal Denetimi:**
   - Hem `getServerSession(authOptions)` hem de ham JWT (`getToken`) doğrulanır; oturum yoksa veya `token.sessionRevoked` işaretliyse `401` döndürülür.
   - Yalnızca `mustChangePassword === true` olan geçici şifre oturumlarında çalışır; normal oturumlardan çağrılırsa `403` döndürür.
2. **Şifre Eşleşme ve Politika Doğrulaması:**
   - Gövdedeki `{ password, confirm }` alanlarının eşleştiği ve `validatePasswordPolicy(password, session.user.email)` kurallarını (12–128 karakter, büyük/küçük harf, rakam, özel karakter, e-posta ile aynı olmama) sağladığı kontrol edilir.
3. **Veritabanı Durumu, Süre ve Tekrar Kullanım Denetimi:**
   - Kullanıcının `isActive`, `mustChangePassword` ve `passwordHash` alanları veritabanından tekrar okunur.
   - `temporaryPasswordStillValid(current)` ile 24 saatlik geçici şifre süresinin dolmadığı doğrulanır.
   - `verifyPassword(password, current.passwordHash)` ile yeni şifrenin geçici şifreyle aynı olması engellenir (`400`).
4. **İyimser Kilitli Güncelleme ve Anında Oturum Düşürme (`sessionVersion`):**
   - Yeni şifre `scrypt` ile özetlenir (`hashPassword`).
   - `prisma.user.updateMany` içinde `where: { id, isActive: true, mustChangePassword: true, sessionVersion: token.sessionVersion }` koşuluyla iyimser kilit (Optimistic Concurrency) uygulanır; `mustChangePassword: false`, `tempPasswordExpiresAt: null` yapılır ve `sessionVersion` `1` artırılarak mevcut JWT anında geçersiz kılınır (eşzamanlı başka bir değişiklik olduysa `409` döner).
   - Başarılı işlem sonunda önbelleksiz `{ ok: true, requireLogin: true }` yanıtı döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/staffAuth.mjs`
- `backend/src/lib/passwordGate.js`
- `backend/src/app/api/auth/[...nextauth]/route.js`
- `frontend/src/pages/ForcePasswordChange.jsx`
