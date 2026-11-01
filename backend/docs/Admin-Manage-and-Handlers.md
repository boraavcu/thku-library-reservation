# Context: admin/manage/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`admin/manage/route.js` ve `handlers.js`, Kütüphane Yönetim Paneli'nin (`AdminPanel.jsx`) tüm idari arka uç operasyonlarını karşılayan merkezi yönetim merkezidir. Sistem istatistiklerinin çekilmesi, kullanıcı banlama/affetme, oda ekleme/silme/güncelleme, randevu iptali, duyuru yönetimi ve sözleşme kurallarını güncelleme operasyonları bu modülde yürütülür.

**Açık/Kapalı Prensibi (OCP):** `route.js` yalnızca NextAuth oturumunu ve `ADMIN` / `DIRECTOR` rol yetkisini doğrular; gelen `action` isteğini `handlers.js` içindeki `ADMIN_ACTION_HANDLERS` komut tablosuna dağıtır. Yeni bir idari fonksiyon eklendiğinde `route.js` koduna dokunulmaz.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Oturum ve Yetkilendirme:** `next-auth` (`getServerSession`, `authOptions` — `ADMIN` ve `DIRECTOR` rolleri)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client — `User`, `Room`, `Reservation`, `Announcement`, `SystemAgreement`, `AuditLog`, `PenaltyLog`)
- **Yardımcı Servisler:**
  - `@/lib/penaltyService` (`manualBanUser`, `manualUnbanUser`)
  - `@/lib/emailService` (`sendReservationCancelledEmails`)
  - `@/lib/timeUtils` (`getIstanbulTimeDetails`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Yetkilendirme ve Aksiyon Yönlendirme (`route.js`)
1. Gelen HTTP `POST` isteğinde `getServerSession(authOptions)` çağrılır.
2. Oturum yoksa veya kullanıcının rolü `ADMIN` ya da `DIRECTOR` değilse `403 Forbidden` (`ADMIN_ROLE_REQUIRED`) fırlatılır.
3. Gövdedeki `{ action, ...payload }` ayrıştırılır; `ADMIN_ACTION_HANDLERS[action]` fonksiyonu çağrılır. Tanımsız bir aksiyonda `400 Invalid Action` dönülür.

### B. Başlangıç Veri Paketi (`GET_INITIAL_DATA`)
Yönetici paneli yüklendiğinde tek HTTP turunda (round-trip) tüm panel bileşenlerinin ihtiyaç duyduğu veriyi döner:
- `stats`: Toplam rezervasyon, bugün tamamlananlar, aktif banlı kullanıcı sayısı ve şu an içeride olan (`CHECKED_IN`) oda sayısı.
- `rooms`: Tüm odalar, kapasiteler, katlar ve aktiflik durumları.
- `reservations`: Son 100 rezervasyon ve detaylı katılımcı listeleri.
- `users`: Sistemdeki tüm öğrenciler, ceza puanları (`PenaltyLog`) ve ban durumları.
- `announcements`: Sistem duyuruları ve geçerlilik tarihleri.
- `activeAgreement`: Yürürlükteki sistem kuralları ve limitleri (`maxAdvanceDays`, `maxDailyHours`, `noShowToleranceMinutes`).

### C. Kullanıcı Disiplin Yönetimi (`BAN_USER` & `UNBAN_USER`)
- **`BAN_USER`:** Kullanıcıyı 30 gün askıya alır (`isBanned: true`, `bannedUntil: now + 30 gün`). `reservationDate: { gte: todayDate }` filtresiyle kullanıcının bugünkü ileri saatli randevuları dahil tüm gelecek rezervasyonlarını iptal eder (`CANCELLED`) ve odaları anında takvime kazandırır.
- **`UNBAN_USER`:** `isBanned: false` yapar ve askı süresini sıfırlar. Her iki işlem de denetim için `AuditLog` tablosuna işlenir.

### D. Oda Yönetimi (`CREATE_ROOM`, `UPDATE_ROOM`, `DELETE_ROOM`)
- **`CREATE_ROOM`:** Yeni oda numarası (`roomNumber`) mükerrerlik kontrolünden geçirilir ve oda şemaya eklenir.
- **`UPDATE_ROOM`:** Oda kapasitesi (`capacity`, `minGroupSize`, `maxGroupSize`) veya aktiflik durumu güncellenir.
- **`DELETE_ROOM`:** Odaya ait gelecekteki rezervasyonlar kontrol edilir; aktif randevusu olan odalar silinemez, önce randevuların iptali veya odanın pasife (`isActive: false`) alınması zorunlu tutulur.

### E. Sistem Kuralları Güncelleme (`UPDATE_RULES`)
- `maxAdvanceDays` (ileri tarih sınırı), `maxDailyHours` (maksimum günlük kullanım) veya tolerans süresi güncellendiğinde mevcut sözleşme pasife alınır ve yeni bir versiyon numarasıyla (`version: current + 1`) yeni bir `SystemAgreement` kaydı açılır (İzlenebilirlik ve Hukuki Uyumluluk).

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/lib/penaltyService.js`
- `backend/src/lib/emailService.js`
- `frontend/src/pages/AdminPanel.jsx`
- `frontend/src/components/admin/*`
