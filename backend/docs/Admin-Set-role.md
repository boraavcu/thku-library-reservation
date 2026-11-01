## 5. `backend/docs/Admin-Set-role.md`

```markdown
# Context: admin/set-role/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/admin/set-role/route.js`, Bilgi İşlem Müdürlüğü Sistem Yöneticisinin (`SUPER_ADMIN`) e-posta adresi üzerinden bir kullanıcının sistem rolünü (`STUDENT`, `LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) doğrudan değiştirmesini sağlayan uç noktadır (`POST`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Oturum:** `next-auth` (`getServerSession`, `authOptions`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `User`, `AdminAction`)

## 3. İş Mantığı ve Güvenlik (`POST`)

1. Oturum açmış kullanıcının rolü kontrol edilir; yalnızca `session.user.role === "SUPER_ADMIN"` ise işleme izin verilir (`403 Unauthorized`).
2. Gövdedeki `{ email, role }` parametreleri doğrulanır (`VALID_ROLES = ["STUDENT", "ADMIN", "LIBRARIAN", "SUPER_ADMIN"]`).
3. Kullanıcının rolü güncellenir ve `AdminAction` tablosuna `USER_ROLE_CHANGED` kaydı düşülür.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/auth/[...nextauth]/route.js`
- `frontend/src/components/admin/UsersTab.jsx`
```
