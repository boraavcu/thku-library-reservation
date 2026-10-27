# Context: auth/[...nextauth]/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/auth/[...nextauth]/route.js`, sistemin kimlik doğrulama (Authentication), kurumsal Microsoft Azure AD (Entra ID) SSO entegrasyonu, güvenli Demo girişi ve JWT oturum zenginleştirme merkezidir.

##  2. Kimlik Doğrulama Sağlayıcıları (Providers)

1. **`AzureADProvider` (Kurumsal Microsoft SSO):**
   - `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` ve `AZURE_AD_TENANT_ID` ortam değişkenleriyle çalışır.
   - Yalnızca üniversitenin resmi e-posta uzantılarına (`@stu.thk.edu.tr` ve `@thk.edu.tr`) sahip hesapların girişine izin verir (`ALLOWED_DOMAINS`).
2. **`CredentialsProvider` (`id: "demo-login"`):**
   - Sunum ve test aşamasında `DEMO_USERS` listesindeki hesaplarla şifresiz hızlı giriş sağlar.
   - `process.env.ENABLE_DEMO_LOGIN !== "false"` koşuluna bağlıdır; canlı ortamda `.env` üzerinden kapatıldığında tamamen devre dışı kalır.
   - **Rol Koruma Kuralı:** `prisma.user.upsert` çalışırken `update` bloğunda `role` alanı ezilmez; böylece Yönetim Panelinden rolü değiştirilen bir kullanıcının yeni rolü tekrar giriş yaptığında korunur.

##  3. Oturum Yaşam Döngüsü ve Otomatik Ban Açma (`jwt` & `session` Callbacks)

Her oturum kontrolünde (`jwt` callback) veritabanından kullanıcının en güncel durumu çekilir ve şu işlemler uygulanır:
1. **Süresi Dolan Banların Otomatik Kaldırılması (`Auto-Unban`):**
   - Eğer kullanıcı banlıysa (`dbUser.isBanned === true`) ve ban bitiş tarihi (`dbUser.banUntil`) geçmişse (`new Date(dbUser.banUntil) <= new Date()`), sistem kullanıcının banını ve ceza puanlarını veritabanında otomatik olarak sıfırlar ve aktif `PenaltyHistory` kayıtlarını pasife çeker.
2. **Aktif No-Show Sayacı ve Oturum Zenginleştirme:**
   - Kullanıcının `PenaltyHistory` tablosundaki aktif `NO_SHOW` kayıtlarının sayısı (`noShowCount`), ban durumu (`isBanned`), ban bitiş tarihi (`banUntil`), ban sebebi (`banReason`), rolü (`role`), bölümü (`department`) ve onayladığı sözleşme versiyonu (`acceptedAgreementVersion`) doğrudan `session.user` nesnesine aktarılır.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Login.jsx`
- Tüm Frontend sayfaları (`useSession`) ve Backend API uç noktaları (`getServerSession`)