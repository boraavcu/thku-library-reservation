# Context: admin/manage/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/admin/manage/route.js`, Yönetim Panelinin (`AdminPanel.jsx`) tüm veri okuma (`GET`) ve idari müdahale (`POST`) işlemlerini tek bir merkezden yürüten ana yönetim API uç noktasıdır. Rol tabanlı erişim kontrolü (`RBAC`), analitik veri üretimi, oda yönetimi, canlı rezervasyon operasyonları, duyuru yayınlama, öğrenci moderasyonu (ban/ceza/yetki) ve dinamik kural güncellemelerini yönetir.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Kimlik Doğrulama:** `next-auth` (`getServerSession`, `authOptions`)
- **Veritabanı & Önbellek:** `@/lib/db` (Prisma), `@/lib/redis` (Kiosk yoklama kümeleri)
- **Yaşam Döngüsü & E-Posta Motoru:** `@/lib/lifecycle` (`runReservationLifecycleChecks`, `sendReservationCancelledEmails`, `sendNoShowWarningEmail`, `queueSafeEmail`, `buildCorporateEmailHtml`, `ALLOWED_DIRECTOR_EMAIL`)

##  3. `GET` Metodu: Analitik, Log Arşivleme ve Veri Yükleme

`STAFF_ROLES = ["LIBRARIAN", "ADMIN", "SUPER_ADMIN"]` dışındaki tüm istekler `403 Forbidden` ile reddedilir.

1. **Otomatik Ön Kontroller ve 365 Günlük Log Temizliği:**
   - Arka planda `runReservationLifecycleChecks()` tetiklenir.
   - `R103` odasının ismi eski kayıtlarda `"Uçantürk"` kalmışsa otomatik olarak `"Hürkuş"` olarak güncellenir.
   - Veritabanı şişmesini önlemek için **365 günden (1 yıldan) eski** `AuditLog` ve `AdminAction` kayıtları otomatik silinir; **son 180 günün (6 ayın)** logları ise `ADMIN` ve `SUPER_ADMIN` (`canViewLogs`) ekranına aktarılır.
2. **Telefon Numarası Destekli Veri Sorguları (`Promise.all`):**
   - Odalar (`rooms`), son 80 rezervasyon (`reservations` — organizatör ve katılımcıların `phone`, `department`, `studentNumber` bilgileriyle), kullanıcılar (`users`), kurallar (`rules`), duyurular (`announcements`), loglar (`auditLogs`, `adminActions`) ve son 30 günün analitik rezervasyonları paralel çekilir.
   - Her rezervasyon için Redis'teki `kiosk:checked_users:${r.id}` kümesi okunarak `checkedInUsers` dizisi ve `checkedInCount` sayısı cevaba eklenir.
3. **Faaliyet Raporu Analitik Hesaplamaları (`analytics`):**
   - **7/24 Saatlik Yoğunluk Isı Haritası (`hourlyHeatmap`):** `00:00` – `24:00` arasındaki 24 saatin her biri için toplam kaç randevu çakıştığını hesaplar ve zirve saati (`peakHourLabel`) belirler.
   - **Bölüm Dağılımı (`departmentBreakdown`) & Oda Tercihleri (`roomBreakdown`):** Hangi bölümün ve hangi odanın yüzde kaç (`percent`) oranında kullanıldığını hesaplar.
   - **Performans Oranları:** Gerçekleşme oranı (`completionRate`), iptal oranı (`cancellationRate`), No-Show oranı (`noShowRate`), ortalama çalışma süresi (`avgDurationHours`) ve ortalama grup büyüklüğü (`avgGroupSize`) metriklerini üretir.

##  4. `POST` Metodu: 8 İdari Aksiyon (`action`)

`body.action` parametresine göre şu 8 işlemi gerçekleştirir ve her işlemi `AdminAction` tablosuna kaydeder:

1. **`TOGGLE_ROOM` (Odayı Aç / Kapat - Tüm Yetkililer):**
   - Odanın `isActive` durumunu değiştirir. **Kritik Kural:** Oda kapatıldığında odaya ait mevcut `CONFIRMED` randevular iptal edilmez; yalnızca yeni randevu alımı durdurulur.
2. **`CREATE_ROOM`, `UPDATE_ROOM`, `DELETE_ROOM` (Sadece `ADMIN` ve `SUPER_ADMIN`):**
   - Yeni oda ekler, mevcut odanın kodunu/adını/kapasitesini günceller veya odayı (bağlı kayıtlarıyla birlikte transaction içinde) siler.
3. **`RESERVATION_OP` (Canlı Rezervasyon Müdahaleleri - Tüm Yetkililer):**
   - `FORCE_CHECKIN`: Randevuyu manuel olarak `CHECKED_IN` yapar ve Kütüphane Müdürüne bilgi maili gönderir.
   - `EARLY_FINISH`: Randevunun bitiş saatini (`endTime`) şu anki saate çekip durumunu `COMPLETED` yapar; böylece kalan saatler takvimde anında diğer öğrencilere açılır.
   - `CANCEL`: Randevuyu `CANCELLED` yapar ve `sendReservationCancelledEmails` ile tüm gruba (onaylıysa müdüre de) iptal maili gönderir.
   - `MARK_NO_SHOW`: Redis'teki yoklama kümesini kontrol eder; kapıda QR okutmayan üyelere `15 puan` (`NO_SHOW`) ceza işler, `3/3` olanları otomatik 30 gün banlar ve `sendNoShowWarningEmail` ile uyarır.
4. **`CREATE_ANNOUNCEMENT` & `DELETE_ANNOUNCEMENT` (Tüm Yetkililer):**
   - Çok dilli (`tr`/`en`) ve öncelikli (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) duyuru yayınlar veya siler.
5. **`USER_MODERATION` (Sadece `ADMIN` ve `SUPER_ADMIN`):**
   - `BAN_USER`: Öğrenciyi seçilen tarihe kadar (`banUntil`) veya kalıcı (`banUntil: null` - Perma Ban) olarak yasaklar, aktif randevularını iptal eder ve e-posta ile bildirir.
   - `UNBAN`: Yasağı kaldırır, `penaltyPoints` değerini `0` yapar ve aktif `PenaltyHistory` kayıtlarını pasife çeker.
   - `RESET_PENALTY`: Öğrencinin No-Show uyarı sayacını sıfırlar.
   - `CHANGE_ROLE`: Rol hiyerarşisini koruyarak yetki değiştirir (`ADMIN` yalnızca `STUDENT <-> LIBRARIAN` ataması yapabilir; `ADMIN` ve `SUPER_ADMIN` atamasını yalnızca `SUPER_ADMIN` yapabilir).
6. **`UPDATE_RULE` (Sadece `ADMIN` ve `SUPER_ADMIN`):**
   - 7 dinamik rezervasyon kuralından (`MIN_PARTICIPANTS`, `MAX_PARTICIPANTS`, `MAX_DURATION_HOURS`, `MAX_ADVANCE_DAYS`, `DAILY_RELEASE_HOUR`, `CHECKIN_TOLERANCE_MINUTES`, `CANCEL_LOCK_MINUTES`) herhangi birini günceller.

##  5. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/AdminPanel.jsx`
- `backend/src/lib/lifecycle.js`