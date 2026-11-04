# Context: loginRateLimit.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/loginRateLimit.js`, kurumsal personel şifreli giriş (`staff-login`) uç noktasını kaba kuvvet (Brute-Force) ve kimlik bilgisi doldurma (Credential Stuffing) saldırılarına karşı koruyan **PostgreSQL tabanlı kalıcı hız sınırlama (Rate Limiting)** servisidir. Hem istemci IP adresi hem de hedef e-posta adresi bazında ayrı kova (`bucket`) özetleri tutarak dağıtık veya yeniden başlatılan sunucu süreçlerinde dahi sıfırlanmayan koruma sağlar.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı & ORM:** PostgreSQL `auth_rate_limits` tablosu & `@/lib/db` (`prisma.$queryRawUnsafe`)
- **Kriptografi & Yardımcılar:**
  - `crypto` (`randomUUID`)
  - `@/lib/staffAuth.mjs` (`rateLimitBucket` — `sha256("${kind}:${value}")`)
  - `@/lib/staffAuthSql.mjs` (`RECORD_LOGIN_FAILURE_SQL`, `CLEAR_LOGIN_BUCKET_SQL`, `LOGIN_WINDOW_SECONDS = 900`, `LOGIN_MAX_FAILURES = 8`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. İstemci IP Çözümleme (`clientIpFromRequest(req)`)
- Next.js `Headers` nesnesi veya düz nesne üzerinden `x-forwarded-for` (ilk IP) ya da `x-real-ip` başlığını güvenli biçimde okur, en fazla 64 karakterle sınırlar; bulunamazsa `"unknown"` döndürür.

### B. Atomik Pencere Sayacı ve Kova Artırımı (`beginLoginAttempt({ email, ip })`)
1. İstek için `rateLimitBucket("ip", ip)` ve (varsa) `rateLimitBucket("email", email)` olmak üzere SHA-256 ile özetlenmiş gizlilik dostu kova anahtarları üretir (açık IP veya e-posta adresi tabloda tutulmaz).
2. Her kova için `auth_rate_limits` tablosunda tek bir atomik `INSERT ... ON CONFLICT (bucket) DO UPDATE` (`RECORD_LOGIN_FAILURE_SQL`) sorgusu çalıştırır:
   - Mevcut `window_start` zamanı 15 dakikalık (`900` sn) pencereden eskiyse sayacı `1`'e sıfırlar ve `window_start = NOW()` yapar.
   - Pencere devam ediyorsa `failures` sayacını atomik olarak `1` artırır.
3. Herhangi bir kovadaki deneme sayısı `LOGIN_MAX_FAILURES` (`8`) sınırını aşarsa (`failures > 8`) `limited: true` döndürerek giriş denemesini veritabanı/şifre doğrulamasına geçmeden `CokFazlaDeneme` hatasıyla durdurur.

### C. Başarılı Girişte Sayaç Temizliği (`clearLoginAttempts(buckets)`)
- Kullanıcı geçerli şifresiyle giriş yaptığında ilgili IP ve e-posta kovalarını `DELETE FROM auth_rate_limits WHERE bucket = $1` ile temizler.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/staffAuth.mjs`
- `backend/src/lib/staffAuthSql.mjs`
- `backend/src/app/api/auth/[...nextauth]/route.js`
- `backend/prisma/schema.prisma` (`AuthRateLimit` modeli)
- `backend/test/staff-account.test.mjs`
