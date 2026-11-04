# Context: kioskStore.js & kioskSql.mjs

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/kioskStore.js` ve `backend/src/lib/kioskSql.mjs`, Kiosk kapı QR yoklama sisteminin kişisel tek kullanımlık doğrulama kodlarını (`kiosk_check_in_codes`), 4 saatlik fiziksel cihaz kilitlerini (`kiosk_device_locks`), kalıcı yoklama kayıtlarını (`kiosk_attendances`) ve adil No-Show ceza hedeflerini harici bir önbellek katmanına ihtiyaç duymadan **tamamen PostgreSQL ACID işlemleri ve satır kilitleri (`SELECT ... FOR UPDATE`)** üzerinde yürüten çekirdek veri katmanıdır.

- **`kioskSql.mjs`:** Saf SQL sorgularını, atomik UPSERT/tüketim mantığını ve ceza hedefi hesaplamalarını barındırır (hem Prisma hem de `pg` test istemcisiyle çalışabilir).
- **`kioskStore.js`:** `kioskSql.mjs` fonksiyonlarını Prisma `$transaction` ve `$queryRawUnsafe` adaptörü (`createPrismaDb`) ile sarmalayarak API rotalarına ve `lifecycle.js` motoruna sunar.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Veritabanı & ORM:** PostgreSQL & `@/lib/db` (`PrismaClient` — `$transaction`, `$queryRawUnsafe`)
- **Kriptografi:** Node.js yerleşik `crypto` modülü (`randomBytes(16)`, `randomUUID()`)
- **Sabitler:**
  - `CODE_TTL_SECONDS = 600` (10 dakika — kişisel oturum doğrulama kodu geçerlilik süresi)
  - `DEVICE_LOCK_SECONDS = 14400` (4 saat — fiziksel cihaz/tarayıcı kilidi süresi)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Kiosk Varlık ve Kilit Okuma (`readKioskPresence`, `getActiveLockOwners`, `listAttendanceUserIds`)
- **`readKioskPresence(reservationId, { deviceKey, hardwareKey, ipUaKey })`:** `Promise.all` ile aynı anda hem `kiosk_device_locks` tablosundaki aktif (`expires_at > NOW()`) cihaz kilit sahiplerini (`DEVICE`, `HARDWARE`, `IP_UA`) hem de `kiosk_attendances` tablosundaki yoklaması alınmış kullanıcı kimliklerini (`checkedUserIds`) çeker.

### B. Kişisel Tek Kullanımlık Kod Üretimi (`issuePersonalCodeForReservation` / `issuePersonalCode`)
- Rezervasyon satırını `SELECT id FROM reservations WHERE id = $1::uuid FOR UPDATE` ile kilitler.
- Kullanıcı zaten `kiosk_attendances` tablosunda kayıtlıysa `{ alreadyCheckedIn: true, code: null }` döndürür.
- Kullanıcının süresi dolmamış ve tüketilmemiş (`consumed_at IS NULL AND expires_at > NOW()`) bir kodu varsa aynı kodu korur; yoksa `kiosk_check_in_codes` tablosuna `ON CONFLICT (reservation_id, user_id) DO UPDATE` ile 600 saniye geçerli 32 karakterlik (`randomBytes(16).toString("hex")`) yeni bir kod yazar.

### C. Atomik Yoklama Tüketimi ve Cihaz Kilitleme (`performCheckIn` / `consumeCheckIn`)
Tek bir PostgreSQL transaction'ı içinde sırasıyla şu adımları uygular:
1. **Satır Kilidi:** `SELECT status FROM reservations WHERE id = $1::uuid FOR UPDATE` ile eşzamanlı yarış durumlarını (Race Condition) engeller; yalnızca `CONFIRMED` veya `CHECKED_IN` durumundaki randevular kabul edilir.
2. **Yabancı Cihaz Kilidi Denetimi:** `DEVICE`, `HARDWARE` veya `IP_UA` kilitlerinden herhangi biri başka bir kullanıcıya aitse `reason: "device_conflict"` döndürür ve öğrencinin kişisel kodunu tüketmez.
3. **Tek Kullanımlık Kod Tüketimi:** `UPDATE kiosk_check_in_codes SET consumed_at = NOW() WHERE ... AND consumed_at IS NULL AND expires_at > NOW()` ile kodu atomik olarak tüketir (Replay Attack koruması).
4. **Cihaz Kilitlerinin Mühürlenmesi (`acquireLock`):** İstemcinin geçerli `DEVICE`, `HARDWARE` ve `IP_UA` anahtarlarını `kiosk_device_locks` tablosuna 14400 saniyeliğine (`expires_at`) mühürler; eşzamanlı çakışma olursa `DEVICE_LOCK_LOST` fırlatarak tüm transaction'ı geri alır (`ROLLBACK`).
5. **Kalıcı Yoklama ve Durum Geçişi:** `kiosk_attendances` tablosuna kayıt ekler (`ON CONFLICT DO NOTHING`). Onaylı katılımcı sayısı `minParticipants` (en az 2) eşiğine ulaştığında rezervasyon durumunu atomik olarak `CONFIRMED -> CHECKED_IN` yapar (`transitioned: true`) ve `onRecorded` geri çağrısıyla `AuditLog` kaydını aynı transaction içinde yazar.

### D. Adil No-Show Ceza Hedefleme ve İddia Kilitleri (`buildPenaltyTargets`, `claimNoShowCancellation`, `claimPenaltyApplied`)
- **`buildPenaltyTargets`:** Yoklama veren öğrencileri (`checkedUserIds`) ceza listesinden muaf tutar; onay sayısı minimumun altındaysa `cancel_no_show`, minimum sağlanmış ama gelmeyen üyeler varsa `penalize_absent` kararını üretir.
- **`claimNoShowCancellation` & `claimPenaltyApplied`:** Paralel yaşam döngüsü veya görevli isteklerinde cezanın yalnızca tek bir işlem tarafından uygulanmasını (`WHERE penalty_applied = FALSE ... RETURNING id`) garanti eder.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/kioskSecurity.js`
- `backend/src/lib/lifecycle.js`
- `backend/src/lib/emailService.js`
- `backend/src/app/api/kiosk/qr/route.js`
- `backend/src/app/api/checkin/validate/route.js`
- `backend/src/app/api/admin/manage/handlers.js`
- `backend/test/kiosk-atomicity.mjs`
