# Context: passwordGate.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/passwordGate.js`, tek kullanımlık geçici şifre ile sisteme giriş yapmış kurumsal personelin (`session.user.mustChangePassword === true`), kalıcı şifresini belirlemeden hiçbir korumalı API uç noktasına veya yönetim aksiyonuna erişememesini sağlayan **API Seviyesi Zorunlu Şifre Değiştirme Kapısı (Password Change Gate)** ve önbellek önleyici yanıt yardımcısıdır.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **HTTP Güvenlik Başlıkları:** `NO_STORE_HEADERS` (`Cache-Control: "no-store"`, `Pragma: "no-cache"`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Önbelleksiz Güvenli JSON Yanıtı (`noStoreJson(body, status = 200)`)
- Geçici şifre üretimi, şifre değişimi ve güvenlik engeli gibi hassas yanıtların tarayıcı veya ara vekil sunucular (proxy) tarafından önbelleğe alınmasını önlemek için `Cache-Control: no-store` ve `Pragma: no-cache` başlıklarıyla `NextResponse.json` üretir.

### B. Zorunlu Şifre Değişimi Denetimi (`rejectIfPasswordChangeRequired(session)`)
- Oturum nesnesinde `session?.user?.mustChangePassword` değeri `true` ise isteği anında `403 Forbidden` HTTP durumu ve `{ error: "Devam etmek için önce kalıcı şifrenizi belirleyin.", code: "PASSWORD_CHANGE_REQUIRED" }` gövdesiyle (`noStoreJson`) reddeder.
- Şifre değişimi gerekmiyorsa `null` döndürerek API akışının devam etmesine izin verir.
- Bu kapının `/api/account/password` dışındaki tüm oturum korumalı uç noktalarda çağrıldığı `backend/test/staff-account.test.mjs` içindeki statik kaynak tarama testiyle otomatik olarak doğrulanır.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/middleware/checkRulesAcceptance.js`
- `backend/src/app/api/account/password/route.js`
- `backend/src/app/api/admin/manage/route.js` & `handlers.js`
- `backend/src/app/api/admin/set-role/route.js`
- Tüm korumalı `backend/src/app/api/*` uç noktaları
- `backend/test/staff-account.test.mjs`
