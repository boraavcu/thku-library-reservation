# Context: test/kiosk-atomicity.mjs & test/staff-account.test.mjs

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/test/kiosk-atomicity.mjs` ve `backend/test/staff-account.test.mjs`, backend iş mantığının en kritik güvenlik, eşzamanlılık (concurrency) ve kimlik doğrulama katmanlarını doğrulayan **20 adet birim ve PostgreSQL atomiklik testinden** oluşan otomatik test paketidir (`npm test` -> `node --test test/*.mjs`).

Veritabanı gerektiren entegrasyon testleri canlı veya geliştirme verilerine kesinlikle dokunmaz; her çalışmada rastgele adlandırılmış izole geçici PostgreSQL şemaları (`thku_kiosk_ephemeral_*` ve `thku_staff_ephemeral_*`) oluşturur ve `finally` bloğunda `DROP SCHEMA ... CASCADE` ile tamamen temizler.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Test Çatısı:** Node.js yerleşik test koşucusu (`node:test`, `node:assert/strict`)
- **Veritabanı İstemcisi:** `pg` (`pg.Pool` üzerinden paralel transaction simülasyonu) & `dotenv`
- **Test Edilen Modüller:** `kioskSql.mjs`, `kioskSecurity.js`, `timeUtils.js`, `staffAuth.mjs`, `staffAuthSql.mjs` ve tüm `src/app/api/**/route.js` dosyaları

## 3. Test Senaryoları ve Doğrulanan Garantiler

### A. `backend/test/kiosk-atomicity.mjs` (Kiosk Güvenliği, Zaman ve PostgreSQL Atomikliği)
1. **Adil No-Show Ceza Hedefleme (`buildPenaltyTargets`):** Kapıda QR okutan kişinin ceza listesine girmediğini, minimum kişi sağlanmadığında `cancel_no_show`, sağlandığında ise yalnızca gelmeyenlere `penalize_absent` üretildiğini ve `penaltyApplied: true` iken cezanın tekrarlanmadığını doğrular.
2. **Kampüs NAT (`eduroam`) ve Gizli Sekme İmza Doğrulaması:** Aynı kampüs IP'sini paylaşan farklı telefonların farklı `hwLockHash` ürettiğini (yanlış pozitif kilitlenme olmadığını), aynı telefondaki gizli sekmenin aynı donanım imzasıyla yakalandığını ve `"no-dev-id"` / `"no-hw"` gibi sahte başlıkların boş kilit listesi döndürdüğünü doğrular.
3. **Kampüs Wi-Fi ve Hücresel Veri Denetimi:** `cellular` bağlantının reddedildiğini, kampüs IP bloğundaki `wifi` bağlantısının kabul edildiğini doğrular.
4. **Gece Yarısı (`23:59 -> 24:00`) Süre Hesabı:** `parseReservationMinutesUTC` fonksiyonunun `21:00 – 23:59` randevusunu tam 180 dakika (`endH = 24`) olarak hesapladığını doğrular.
5. **PostgreSQL Eşzamanlılık ve Satır Kilidi Alt Testleri (`kiosk postgres atomikliği` — 7 Alt Test):**
   - Süresi dolmuş kodun yoklama yazmadığını (`invalid_code`),
   - Aynı kodun ikinci kez kullanılamadığını (`already_checked_in`),
   - `Promise.all` ile aynı anda gönderilen iki paralel isteğin tek yoklama ürettiğini,
   - Aynı fiziksel cihaz anahtarının paralel istekte iki farklı kullanıcıya verilmediğini (`device_conflict`) ve kaybeden kullanıcının kodunun tüketilmediğini (`consumed_at === null`),
   - Minimum katılımcı eşiğine ulaşıldığında `CONFIRMED -> CHECKED_IN` geçişinin yalnızca bir kez (`transitioned === true`) tetiklendiğini,
   - Kod ve kilit kayıtları silinse bile `kiosk_attendances` yoklama kaydının ve ceza kararının korunduğunu,
   - Paralel `claimNoShowCancellation` çağrılarında No-Show iptal kilidinin yalnızca tek bir işlem tarafından kazanıldığını doğrular.

### B. `backend/test/staff-account.test.mjs` (Kurumsal Personel Hesabı, Kriptografi ve Kapı Denetimi)
1. **Kurumsal Alan Adı Doğrulaması (`isExactThkStaffEmail`):** Yalnızca tam `@thk.edu.tr` adreslerinin kabul edildiğini; `@stu.thk.edu.tr` ve sahte alt alan adlarının reddedildiğini doğrular.
2. **Şifre Politikası (`validatePasswordPolicy`):** Uzunluk, karakter çeşitliliği ve e-posta benzerliği kurallarını test eder.
3. **Geçici Şifre ve `scrypt` Özeti:** 20 karakterlik geçici şifrenin gücünü, açık metnin özette yer almadığını ve `verifyPassword` doğrulamasını test eder.
4. **Sızıntı Koruması (`buildTempPasswordQueueRecord`, `projectSessionUser`, `toAdminUser`):** Geçici şifrenin ve `passwordHash` / `sessionVersion` alanlarının e-posta kuyruğuna, oturum nesnesine veya admin listesine sızmadığını doğrular.
5. **Microsoft SSO Profil Koruması (`buildMicrosoftProfileUpdate`):** SSO profil güncellemesinin `role`, `mustChangePassword` ve `sessionVersion` alanlarını ezmediğini doğrular.
6. **Geçici Şifre Süre Kontrolü (`temporaryPasswordStillValid`):** Süresi dolmuş geçici şifrelerin reddedildiğini doğrular.
7. **Kalıcı Giriş Hız Sınırı (`recordLoginFailure`):** Geçici PostgreSQL şemasında `LOGIN_MAX_FAILURES` (`8`) aşımında hesabın kilitlendiğini ve 15 dakikalık pencere sonunda sayacın sıfırlandığını doğrular.
8. **Statik API Kapı Taraması:** `/api/account/password` hariç `getServerSession(authOptions)` kullanan tüm API `route.js` dosyalarının `rejectIfPasswordChangeRequired(session)` kapısını çağırdığını kaynak kod üzerinden otomatik denetler.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/kioskSql.mjs` & `backend/src/lib/kioskSecurity.js`
- `backend/src/lib/staffAuth.mjs` & `backend/src/lib/staffAuthSql.mjs`
- Tüm `backend/src/app/api/**/route.js` dosyaları
