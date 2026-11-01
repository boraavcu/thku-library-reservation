## 1. Dosyanın Amacı ve Mimari Rolü

`admin/set-role/route.js`, sistemin ilk kurulumunda (cold-start) veya acil durum kurtarma senaryolarında bir kullanıcıya `ADMIN` veya `DIRECTOR` rolü atamak için tasarlanmış güvenli uç noktadır.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `User`, `AuditLog`)
- **Oturum:** `next-auth` (`getServerSession`)
- **Çevre Değişkeni:** `process.env.DIRECTOR_SETUP_SECRET`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Çift Kademeli Güvenlik Kontrolü (`POST`)
Rol yükseltme işlemi için iki yöntemden biri zorunludur:
1. **Kurulum Parolası:** Gövdede gönderilen `setupSecret` parametresinin sunucu ortamındaki `DIRECTOR_SETUP_SECRET` ile tam eşleşmesi, VEYA
2. **Yönetici Yetkisi:** İsteği atan oturum sahibinin `role === "DIRECTOR"` olması.

### B. Rol Atama ve Denetim Kaydı
- Hedef kullanıcının e-postası veya ID'si ile kullanıcı kaydı bulunur.
- Kullanıcı rolü istenen seviyeye (`ADMIN` veya `DIRECTOR`) güncellenir.
- İşlem `AuditLog` tablosuna `ROLE_UPDATED` eylemiyle ve güvenlik gerekçesiyle loglanır.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/auth/[...nextauth]/route.js`
- `backend/prisma/seed.cjs`