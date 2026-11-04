# Context: staffAccount.js, staffAuth.mjs, staffAuthSql.mjs & staffMail.js

## 1. Dosyanın Amacı ve Mimari Rolü

Bu dört modül, THKÜ Kütüphane ve Bilgi İşlem personelinin (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) kurumsal `@thk.edu.tr` e-posta ve şifre ile güvenli giriş yapabilmesi için gereken **hesap oluşturma, kriptografik şifre özetleme, 24 saatlik tek gösterimlik geçici şifre üretimi/sıfırlama, zorunlu şifre değişimi (`mustChangePassword`), anında oturum düşürme (`sessionVersion`), hesap aktif/pasif yönetimi ve SMTP bilgilendirme** altyapısını oluşturur.

- **`backend/src/lib/staffAuth.mjs`:** Kriptografik `scrypt` şifre özetleme, sabit zamanlı doğrulama, e-posta/şifre politikası doğrulayıcıları ve hassas veri sızdırmayan oturum/admin projeksiyon fonksiyonlarını barındırır.
- **`backend/src/lib/staffAccount.js`:** `SUPER_ADMIN` ve `ADMIN` tarafından tetiklenen kurumsal hesap açma (`createStaffAccount`), geçici şifre yenileme (`resetStaffTempPassword`) ve hesap aktif/pasif etme (`setStaffActive`) iş akışlarını yürütür.
- **`backend/src/lib/staffAuthSql.mjs`:** PostgreSQL `auth_rate_limits` tablosu üzerinde çalışan atomik başarısız giriş sayacı SQL sorgularını tanımlar.
- **`backend/src/lib/staffMail.js`:** Üretilen geçici şifreyi kurumsal personele SMTP üzerinden iletirken `EmailQueue` veritabanı kaydına geçici şifrenin açık metnini kesinlikle yazmayan güvenli bildirim servisidir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Kriptografi:** Node.js yerleşik `node:crypto` (`scrypt`, `timingSafeEqual`, `randomBytes`, `randomInt`, `createHash`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`, `AdminAction`, `EmailQueue`)
- **E-Posta:** `nodemailer` & `@/lib/publicPaths` (`getFrontendBaseUrl`)
- **Sabitler:**
  - `SCRYPT_N = 16384`, `SCRYPT_R = 8`, `SCRYPT_P = 1`, `KEY_LENGTH = 64`
  - `TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000` (24 saat geçici şifre ömrü)
  - `STAFF_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"]`
  - `LOGIN_WINDOW_SECONDS = 900` (15 dakika), `LOGIN_MAX_FAILURES = 8`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Kurumsal E-Posta ve Güçlü Şifre Politikası (`staffAuth.mjs`)
- **`isExactThkStaffEmail(email)`:** Yalnızca tam `@thk.edu.tr` uzantılı adresleri kabul eder; `@stu.thk.edu.tr` öğrenci adreslerini ve alt alan adlarını kesin olarak reddeder.
- **`validatePasswordPolicy(password, email)`:** Kalıcı şifrenin 12–128 karakter arasında olmasını, en az bir büyük harf, küçük harf, rakam ve özel karakter içermesini ve e-posta adresiyle aynı olmamasını zorunlu kılar.
- **`generateTempPassword()`:** Karıştırılmış karakter havuzundan 20 karakter uzunluğunda kriptografik olarak güvenli geçici şifre üretir.
- **`hashPassword` & `verifyPassword`:** 16 bayt rastgele tuz (`salt`) ve `scrypt` (`N=16384, r=8, p=1`) ile `scrypt$16384$8$1$<saltHex>$<keyHex>` formatında özet üretir; doğrulamada zamanlama saldırılarını (Timing Attack) önlemek için `timingSafeEqual` kullanır.
- **`projectSessionUser` & `toAdminUser`:** `passwordHash`, `tempPasswordExpiresAt` ve `sessionVersion` gibi hassas alanları istemciye giden oturum ve yönetim paneli yanıtlarından tamamen arındırır.

### B. Kurumsal Hesap Yaşam Döngüsü (`staffAccount.js`)
1. **`createStaffAccount({ adminId, fullName, email, department, role })`:**
   - Büyük/küçük harf duyarsız (`lower(email)`) çakışma kontrolü yapar (`409 Conflict`).
   - 24 saat geçerli geçici şifre üretir, `mustChangePassword: true`, `sessionVersion: 1` ile kullanıcıyı oluşturur ve `USER_ACCOUNT_CREATED` denetim kaydı düşer (geçici şifre loga yazılmaz).
   - Yöneticiye tek gösterimlik `temporaryPassword` değerini döndürür ve SMTP bilgilendirmesini tetikler.
2. **`resetStaffTempPassword({ adminId, targetUserId })`:**
   - Yeni 24 saatlik geçici şifre üretir, `mustChangePassword: true` yapar ve `sessionVersion: { increment: 1 }` ile kullanıcının açık olan tüm eski oturumlarını anında geçersiz kılar (`TEMP_PASSWORD_RESET`).
3. **`setStaffActive({ adminId, adminRole, targetUserId, isActive })`:**
   - Yöneticinin kendi hesabını pasifleştirmesini engeller. `SUPER_ADMIN` tüm yetkili hesapları, `ADMIN` ise yalnızca `LIBRARIAN` hesaplarını aktif/pasif yapabilir.
   - Durum değiştiğinde `sessionVersion: { increment: 1 }` ile pasife alınan hesabın mevcut JWT oturumunu anında düşürür.

### C. Gizlilik Korumalı Geçici Şifre E-Postası (`staffMail.js`)
- **`deliverTempPasswordEmail`:** Personele giriş adresi (`getFrontendBaseUrl()`) ve 24 saatlik geçici şifreyi düz metin e-posta ile iletir.
- **`buildTempPasswordQueueRecord`:** `EmailQueue` tablosuna kayıt düşerken gövdeye *"Geçici şifre güvenlik nedeniyle bu kayda yazılmadı."* yazar ve olası SMTP hata mesajlarında geçici şifre geçiyorsa `[gizli]` olarak maskeler.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/admin/manage/handlers.js`
- `backend/src/app/api/admin/manage/route.js`
- `backend/src/app/api/auth/[...nextauth]/route.js`
- `backend/src/app/api/account/password/route.js`
- `backend/src/lib/loginRateLimit.js`
- `backend/test/staff-account.test.mjs`
