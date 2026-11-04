# Context: auth/[...nextauth]/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/auth/[...nextauth]/route.js`, sistemin merkezi kimlik doğrulama (Authentication), kurumsal Microsoft Azure AD (Entra ID) SSO entegrasyonu, kurumsal personel şifreli girişi (`staff-login`), kontrollü Demo girişi (`demo-login`), oturum iptali (`sessionVersion` & `isActive`) ve `/randevu` alt dizin çerez izolasyonu merkezidir.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Kimlik Doğrulama:** `next-auth`, `next-auth/providers/azure-ad`, `next-auth/providers/credentials`
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `User`, `PenaltyHistory`)
- **Güvenlik & Hız Sınırı:**
  - `@/lib/loginRateLimit` (`beginLoginAttempt`, `clearLoginAttempts`, `clientIpFromRequest`)
  - `@/lib/staffAuth.mjs` (`verifyPassword`, `hashPassword`, `normalizeEmail`, `banIsActive`, `temporaryPasswordStillValid`, `buildMicrosoftProfileUpdate`, `projectSessionUser`)
  - `@/lib/publicPaths` (`getFrontendBaseUrl`)

## 3. Kimlik Doğrulama Sağlayıcıları ve Oturum Yaşam Döngüsü

### A. 3 Kimlik Doğrulama Sağlayıcısı (`providers`)
1. **`AzureADProvider` (`azure-ad` — Kurumsal Microsoft SSO):**
   - `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` ve `AZURE_AD_TENANT_ID` ile çalışır (`prompt: "login"`).
   - `signIn` geri çağrısında öğrenci e-postalarından (`/^s(\d+)@stu\.thk\.edu\.tr$/i`) öğrenci numarasını otomatik ayrıştırır (`extractStudentNumber`) ve `buildMicrosoftProfileUpdate` ile kullanıcının rolünü, `sessionVersion` değerini veya şifre zorunluluğunu ezmeden profilini günceller; pasif (`isActive: false`) hesapların girişini reddeder.
2. **`CredentialsProvider` (`id: "demo-login"` — Kontrollü Demo Girişi):**
   - `ENABLE_DEMO_LOGIN === "false"` olduğunda `DemoDevreDisi` hatasıyla tamamen kapatılır.
   - `DEMO_USERS` sözlüğünden seçilen hesabı (`s250444902@stu.thk.edu.tr`, demo öğrenciler, görevli, müdür ve BİM hesapları) kendi tanımlı rolüyle (`selectedDemo.role`) ve `isActive: true` olarak eşleştirir.
3. **`CredentialsProvider` (`id: "staff-login"` — Kurumsal Personel Şifreli Girişi):**
   - `beginLoginAttempt({ email, ip })` ile PostgreSQL `auth_rate_limits` tablosu üzerinden 15 dakikada en fazla 8 başarısız deneme sınırı uygular (`CokFazlaDeneme`).
   - Kullanıcı bulunamasa bile zamanlama saldırısını (Timing Attack) önlemek için `dummyPasswordHash()` üzerinde `scrypt` doğrulaması çalıştırır.
   - `user.passwordHash` varlığını, `verifyPassword` eşleşmesini, `user.isActive` durumunu, `!banIsActive(user)` kontrolünü ve geçici şifre ise `temporaryPasswordStillValid(user)` (24 saat) süresini doğrular; başarılı girişte hız sınırı kovalarını temizler (`clearLoginAttempts`).

### B. Oturum Yaşam Döngüsü, `sessionVersion` İptali ve Otomatik Ban Açma (`jwt` & `session`)
Her `jwt` kontrolünde veritabanından güncel kullanıcı durumu çekilir:
1. **Otomatik Ban Açma (`Auto-Unban`):** `dbUser.isBanned` aktif ve `banUntil` tarihi geçmişse kullanıcının banı ve ceza puanları otomatik sıfırlanır, aktif `PenaltyHistory` kayıtları pasife çekilir.
2. **Anında Oturum Düşürme (`isActive` & `sessionVersion`):**
   - Kullanıcı pasife alınmışsa (`dbUser.isActive === false`) veya veritabanındaki `dbUser.sessionVersion` değeri JWT içindeki `token.sessionVersion` ile uyuşmuyorsa (şifre değişimi, geçici şifre sıfırlama veya pasifleştirme sonrası), `token.sessionRevoked = true` yapılır ve `userId` / `role` temizlenir.
3. **Güvenli Oturum Projeksiyonu (`projectSessionUser`):**
   - `session.user` içine `id`, `name`, `role`, `studentNumber`, `image`, `acceptedAgreementVersion`, `penaltyPoints`, `noShowCount`, `isBanned`, `banUntil`, `banReason` ve `mustChangePassword` alanları aktarılır; `passwordHash`, `tempPasswordExpiresAt` ve `sessionVersion` kesinlikle istemciye sızdırılmaz.

### C. `/randevu` Alt Dizin Yönlendirmeleri ve Üretim Çerezleri (`pages`, `redirect`, `cookies`)
- `pages.signIn` ve `pages.error` üretimde `"/randevu/"`, geliştirmede `${FRONTEND_URL}/randevu/` adresine yönlendirilir; `redirect` geri çağrısı açık yönlendirme (Open Redirect) açıklarını `getFrontendBaseUrl()` ile engeller.
- Üretim ortamında (`NODE_ENV === "production"`) `__Secure-next-auth.session-token` dahil tüm NextAuth çerezleri `httpOnly: true`, `sameSite: "lax"`, `secure: true` ve `path: "/randevu"` olarak sınırlandırılır.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/staffAuth.mjs` & `backend/src/lib/loginRateLimit.js`
- `backend/src/lib/publicPaths.js` & `backend/src/lib/passwordGate.js`
- `frontend/src/pages/Login.jsx` & `frontend/src/pages/ForcePasswordChange.jsx`
- Tüm korumalı Backend API uç noktaları (`getServerSession`)
