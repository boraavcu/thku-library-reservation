# Context: checkRulesAcceptance.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/middleware/checkRulesAcceptance.js`, rezervasyon ve oda listeleme API uç noktalarının başında çağrılan **Zorunlu Şifre Değişimi ve Sözleşme Versiyon Doğrulama (Agreement Guard)** ara katmanıdır. Geçici şifresini değiştirmemiş kurumsal personelin veya veritabanındaki aktif sözleşme versiyonunu (`v1.0` vb.) henüz onaylamamış kullanıcıların API üzerinden işlem yapmasını engeller.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum Doğrulama:** `next-auth` (`getServerSession`, `authOptions`)
- **Şifre Kapısı:** `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`, `Agreement`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (`checkRulesAcceptance`)

1. `getServerSession(authOptions)` ile aktif oturumu alır.
2. **Zorunlu Şifre Değişimi Kapısı:** `rejectIfPasswordChangeRequired(session)` çağrılır; `session.user.mustChangePassword === true` ise `403 PASSWORD_CHANGE_REQUIRED` (`Cache-Control: no-store`) yanıtıyla isteği anında durdurur.
3. Oturum açmış geçerli bir kullanıcı e-postası yoksa (`!session?.user?.email`) `401 Unauthorized` döndürür.
4. `Promise.all` ile paralel olarak:
   - Kullanıcının veritabanındaki `acceptedAgreementVersion` alanını,
   - `Agreement` tablosundaki `isActive: true` olan güncel sözleşmenin `version` alanını çeker.
5. Aktif sözleşme yoksa, kullanıcı henüz hiçbir sözleşme onaylamamışsa veya onayladığı versiyon güncel versiyonla eşleşmiyorsa (`dbUser.acceptedAgreementVersion !== activeAgreement.version`), `403 Forbidden` ile birlikte `{ error: "Agreement not accepted or outdated", requiresRulesAcceptance: true }` yanıtı döndürür.
6. Tüm kontroller başarılıysa `null` döndürerek API işleminin devam etmesine izin verir.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/passwordGate.js`
- `backend/src/app/api/reservations/route.js`
- `backend/src/app/api/rooms/route.js`
- `frontend/src/pages/RulesAcceptance.jsx`
