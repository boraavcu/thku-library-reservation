# Context: admin/set-role/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/admin/set-role/route.js`, Bilgi İşlem Müdürlüğü Sistem Yöneticisinin (`SUPER_ADMIN`) e-posta adresi üzerinden bir kullanıcının sistem rolünü (`STUDENT`, `LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) doğrudan değiştirmesini sağlayan yönetim uç noktasıdır (`POST`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`, `AdminAction`)

## 3. İş Mantığı ve Güvenlik (`POST`)

1. **Oturum ve Zorunlu Şifre Değişimi Kapısı:** `getServerSession(authOptions)` çağrıldıktan hemen sonra `rejectIfPasswordChangeRequired(session)` denetlenir; geçici şifresini değiştirmemiş bir `SUPER_ADMIN` oturumu varsa `403 PASSWORD_CHANGE_REQUIRED` ile engellenir.
2. **Yetki Kontrolü:** Yalnızca geçerli oturuma sahip ve `session.user.role === "SUPER_ADMIN"` olan kullanıcılara izin verilir (`403 Unauthorized`).
3. **Parametre Doğrulaması:** Gövdedeki `{ email, role }` parametreleri kontrol edilir (`VALID_ROLES = ["STUDENT", "ADMIN", "LIBRARIAN", "SUPER_ADMIN"]`).
4. **Güncelleme ve Denetim Kaydı:** E-posta adresi küçük harfe normalize edilerek kullanıcının rolü güncellenir ve `AdminAction` tablosuna `USER_ROLE_CHANGED` kaydı düşülür.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/passwordGate.js`
- `backend/src/app/api/auth/[...nextauth]/route.js`
- `frontend/src/components/admin/UsersTab.jsx`
