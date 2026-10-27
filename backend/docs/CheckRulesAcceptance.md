# Context: checkRulesAcceptance.js

##  1. Dosyanın Amacı ve Mimari Rolü

`checkRulesAcceptance.js`, rezervasyon ve oda listeleme API uç noktalarının başında çağrılan **Sözleşme Versiyon Doğrulama (Agreement Guard)** ara katmanıdır. Kullanıcının veritabanındaki aktif sözleşme versiyonunu (`v1.0` vb.) onaylamadan API üzerinden işlem yapmasını engeller.

##  2. İş Mantığı (`checkRulesAcceptance`)

1. `getServerSession(authOptions)` ile oturum kontrolü yapar; oturum yoksa `401 Unauthorized` döndürür.
2. `Promise.all` ile paralel olarak:
   - Kullanıcının veritabanındaki `acceptedAgreementVersion` alanını,
   - `Agreement` tablosundaki `isActive: true` olan güncel sözleşmenin `version` alanını çeker.
3. Eğer aktif sözleşme yoksa, kullanıcı henüz hiçbir sözleşme onaylamamışsa veya onayladığı versiyon güncel versiyonla eşleşmiyorsa (`dbUser.acceptedAgreementVersion !== activeAgreement.version`), `403 Forbidden` ile birlikte `{ error: "Agreement not accepted or outdated", requiresRulesAcceptance: true }` yanıtı döndürür.
4. Her şey uygunsa `null` döndürerek API işleminin devam etmesine izin verir.

##  3. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/reservations/route.js`
- `backend/src/app/api/rooms/route.js`
- `frontend/src/pages/RulesAcceptance.jsx`