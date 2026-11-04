<div align="center">

# THK Üniversitesi 7/24 Kütüphane Grup Çalışma Odaları<br/>Rezervasyon ve Kiosk Yoklama Sistemi

### Kurumsal Sistem Mimarisi, Güvenlik Standartları ve Mühendislik Dokümantasyonu (v5.0 SOLID Production)

<p align="center">
  <a href="/README.md"><img src="https://img.shields.io/badge/%F0%9F%8F%9B%EF%B8%8F_Ana_Sayfa-Root_README-0F172A?style=for-the-badge" alt="Root README" /></a>
  <a href="/docs/THKU_LIBRARY_RESERVATION_SYSTEM_EN.md"><img src="https://img.shields.io/badge/%F0%9F%8C%90_Switch_Language-English_(EN)-C8102E?style=for-the-badge" alt="English Version" /></a>
  <a href="/backend/docs/README.md"><img src="https://img.shields.io/badge/%E2%9A%99%EF%B8%8F_Backend_Dok%C3%BCmanlar%C4%B1-38_Mod%C3%BCl-1E3A8A?style=for-the-badge" alt="Backend Docs" /></a>
  <a href="/frontend/docs/README.md"><img src="https://img.shields.io/badge/%F0%9F%92%BB_Frontend_Dok%C3%BCmanlar%C4%B1-24_Mod%C3%BCl-047857?style=for-the-badge" alt="Frontend Docs" /></a>
  <a href="/deploy/README.md"><img src="https://img.shields.io/badge/%F0%9F%9A%80_Canl%C4%B1_Da%C4%9F%C4%B1t%C4%B1m-Apache_%2B_PM2-7C3AED?style=for-the-badge" alt="Deploy Docs" /></a>
</p>

</div>

---

## 1. Proje Özeti ve Mimari Vizyon (Executive Overview)

Bu proje, **Türk Hava Kurumu Üniversitesi (THKÜ)** öğrencileri, akademisyenleri ve kütüphane yönetimi için kurumsal standartlarda ve **SOLID** yazılım mimarisi prensipleriyle geliştirilmiş, harici bellek servisine (Redis vb.) bağımlılık duymadan doğrudan **PostgreSQL atomik kilitleri** üzerinde çalışan **7/24 kesintisiz Grup Çalışma Odaları Rezervasyon, Fiziksel Kiosk QR Yoklama ve Analitik Yönetim Sistemidir**.

| Çekirdek Yetenek | Mühendislik Çözümü ve Operasyonel Katkısı |
| :--- | :--- |
| **Microsoft Entra ID SSO & Kurumsal Personel Şifre Girişi** | Öğrenciler için Microsoft Entra ID (Azure AD) SSO; `@thk.edu.tr` personeli için `scrypt` (`N=16384`) şifre girişi, 72 saatlik geçici şifre, zorunlu şifre yenileme (`mustChangePassword`), `sessionVersion` ile anında oturum düşürme ve PostgreSQL tabanlı brute-force koruması (`loginRateLimit.js`). |
| **PostgreSQL Atomik 4 Katmanlı Kiosk & WebGL Donanım Kilidi** | Kapı QR parametresi, Kampüs Wi-Fi (`eduroam`) & Anti-VPN denetimi, opsiyonel Haversine GPS yarıçapı ve gizli sekme (Incognito) korumalı WebGL GPU + IP/UA cihaz kilidi (`kioskSecurity.js`, `kioskStore.js`, `SELECT ... FOR UPDATE`). |
| **Otonom Yaşam Döngüsü & Adil No-Show Motoru** | Her 30 saniyede bir çalışan zamanlayıcı (`lifecycle.js`), süresi dolan `CONFIRMED` ve `CHECKED_IN` randevuları eksiksiz tamamlayan durum makinesi, kapıda QR okutan öğrenciyi koruyan adil ceza algoritması ve 3/3 ihlalde 30 gün otomatik ban (`penaltyService.js`). |
| **Merkezi Rezervasyon Politikası & Kota Motoru** | 7 dinamik sistem kuralı, günlük 1 randevu kotası, gece (`21:00–24:00`) / sabah (`00:00–08:00`) ardışık kuralı ve banlanan öğrencilerin randevularını adil düşürme servisi (`reservationPolicy.js`). |
| **Dinamik "Walk-In" Zaman Penceresi (`timeUtils.js`)** | Gelmeyen veya erken boşaltılan odaları ara dakikalarda saniyesinde kullanıma açan ve yeni gruba özel 15 dakikalık Kiosk onay penceresi tanımlayan algoritma. |
| **Olay Güdümlü Kurumsal HTML E-Posta Servisi** | Arayüzü bloklamayan (Zero-Lag), `EmailQueue` veritabanı kuyruklu ve XSS korumalı duyarlı (responsive) kurumsal HTML şablonlu bildirim motoru (`emailService.js`). |
| **`/randevu` Alt Dizin & Apache + PM2 Üretim Mimarisi** | Mevcut kurumsal web sunucusundaki diğer uygulamaları etkilemeden `/randevu` alt dizininde (`runtimePaths.js`, `publicPaths.js`, `apache-randevu.conf`) izole çalışan üretime hazır mimari. |

---

## 2. Teknoloji Yığını ve Altyapı Mimarisi (Tech Stack)

Proje; sıfır yarış durumu (race-condition), tek veritabanı üzerinde atomik tutarlılık ve hızlı yanıt süreleri için ayrıştırılmış (decoupled) modern bir Full-Stack JavaScript mimarisi üzerine inşa edilmiştir:

| Katman | Teknoloji / Kütüphane | Mimari Rolü ve Kullanım Amacı |
| :--- | :--- | :--- |
| **Frontend (İstemci)** | React 19 (Vite 7), React Router v7 | `/randevu` alt dizin destekli (`runtimePaths.js`) tek sayfa uygulaması (SPA) |
| **UI & Tasarım Sistemi** | Material-UI (`@mui/material` v7), `theme.js` | Kurumsal renk paleti (`#C8102E` & `#0F172A`), tipografi ve `@media print` A4 rapor uyumluluğu |
| **Çoklu Dil (i18n)** | `i18next` & `react-i18next` | Tüm arayüz, sözleşme, hata mesajları ve bildirimlerde **%100 Türkçe (`TR`) ve İngilizce (`EN`)** desteği |
| **Backend (API & Edge)** | Next.js 16 (App Router), Edge Middleware | Headless RESTful API uç noktaları (`/api/*`), arka plan zamanlayıcısı ve JWT rol güvenlik duvarı |
| **Kimlik Doğrulama** | `next-auth` (v4) — Azure AD + Credentials | Microsoft Entra ID SSO + `@thk.edu.tr` Personel Şifre Girişi (`scrypt`) + `.env` kontrollü Demo Modu |
| **Veritabanı & Kiosk Durumu** | PostgreSQL 16 & Prisma ORM (`db.js`) | **24 modelli** ilişkisel şema; `Serializable` randevu transaction'ları ve `FOR UPDATE` satır kilitli Kiosk OTP, yoklama ve 4 saatlik cihaz kilidi tabloları (`kioskStore.js`) |
| **E-Posta Motoru** | `nodemailer` (`emailService.js`, `staffMail.js`) | Kurumsal SMTP/TLS entegrasyonu, `EmailQueue` hata toleranslı kuyruk ve XSS korumalı HTML şablon motoru |
| **Üretim Dağıtımı** | Apache (`*:443` Reverse Proxy) + PM2 | `frontend/dist` statik sunumu, `/randevu/api/` ters vekil yönlendirmesi ve `thku-randevu-api` süreç yönetimi |

---

## 3. Kimlik Doğrulama Mimarisi: Azure AD SSO ve Kurumsal Personel Şifre Girişi

### 3.1. Çift Kanallı Kurumsal Giriş Yapısı (`Login.jsx` & `[...nextauth]/route.js`)
Sistem iki kurumsal kimlik doğrulama kanalını aynı anda destekler:
1. **Microsoft Entra ID (Azure AD) Kurumsal SSO (`azure-ad`):**
   - `@stu.thk.edu.tr` öğrencileri ve Microsoft SSO kullanan personel tek tıkla giriş yapar.
   - İlk kez giren kullanıcılar `STUDENT` rolüyle kaydedilir; mevcut yetkili roller (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) korunur ve yalnızca profil bilgileri senkronize edilir.
   - **Otomatik Ban Açma (`Auto-Unban`):** `isBanned: true` olan kullanıcının `banUntil` süresi dolmuşsa giriş anında banı ve aktif `PenaltyHistory` kayıtları otomatik temizlenir.
2. **Kurumsal `@thk.edu.tr` Personel Şifre Girişi (`staff-login`):**
   - Azure AD lisansı veya yönlendirmesi olmadan doğrudan görevli/yönetici erişimi için yalnızca `@thk.edu.tr` uzantılı (`@stu.thk.edu.tr` hariç) hesaplara açıktır.
   - Şifreler Node.js yerleşik `crypto.scrypt` (`N=16384, r=8, p=1, 64 byte`) ve 16 byte rastgele tuz ile özetlenir; doğrulama `timingSafeEqual` ile sabit zamanda yapılır (`staffAuth.mjs`).
   - `SUPER_ADMIN` yönetim panelinden kurumsal hesap oluşturduğunda veya şifre sıfırladığında **72 saat geçerli tek gösterimlik geçici şifre** üretilir ve `mustChangePassword = true` işaretlenir.
   - Geçici şifreyle giriş yapan personel `RequirePasswordChanged` (`App.jsx`) ve backend `checkMustChangePassword` (`passwordGate.js`) kapılarıyla şifresini değiştirene kadar `/change-password` ekranında tutulur.
   - Şifre değişimi, rol değişikliği veya hesabın pasife alınması (`isActive = false`) durumunda `sessionVersion` artırılarak açık olan tüm eski JWT oturumları anında geçersiz kılınır.
   - `login_rate_limits` tablosu üzerinden hem e-posta hem istemci IP bazında 10 dakikalık pencerede kaba kuvvet (brute-force) koruması uygulanır (`loginRateLimit.js`).

### 3.2. Mantıksal Akış Diyagramı

```text
+-------------------------------------------------------------------------+
|                  [ Kullanıcı Tarayıcısı (Login.jsx) ]                   |
+-------------------------------------------------------------------------+
                   |                                   |
     "Microsoft ile Giriş Yap"             "Kurumsal @thk.edu.tr Şifre Girişi"
                   |                                   |
                   v                                   v
+------------------------------------+   +--------------------------------+
|  [ /api/auth/signin/azure-ad ]     |   | [ /api/auth/callback/staff ]   |
|  Microsoft Entra ID OAuth 2.0      |   | PostgreSQL Rate-Limit + scrypt |
+------------------------------------+   +--------------------------------+
                   |                                   |
                   +-----------------+-----------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|       [ JWT & Session Zenginleştirme (auth/[...nextauth]/route.js) ]    |
|  - Auto-Unban, isActive & sessionVersion Kontrolü, mustChangePassword   |
+-------------------------------------------------------------------------+
                   |                                   |
     (mustChangePassword = true)         (Aktif Sözleşme & Rol Yönlendirme)
                   v                                   v
      [ /change-password ]               [ /rules -> /dashboard | /admin ]
```

---

## 4. Kurumsal Güvenlik ve Secret Yönetim Mimarisi

Hassas yapılandırma değişkenleri (`DATABASE_URL`, `NEXTAUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `SMTP_PASS`, `LIBRARY_LAT`, `LIBRARY_LNG`, `CAMPUS_IP_PREFIX`) `.gitignore` ile kaynak koddan izole edilmiştir ve üretim ortamında yalnızca sunucu `.env` dosyasında veya kurumsal **Secret Manager / Key Vault** üzerinde tutulur. Canlı ortamda `ENABLE_DEMO_LOGIN="false"` ve `VITE_ENABLE_DEMO_LOGIN="false"` yapılarak demo giriş kanalı hem arayüzde hem API seviyesinde kapatılır.

---

## 5. Çekirdek Mühendislik Modülleri ve Sistem İnovasyonları (SOLID)

### 5.1. PostgreSQL Tabanlı 4 Katmanlı Fiziksel Kiosk QR ve "Anti-Incognito" Cihaz Kilidi (`kioskSecurity.js`, `kioskStore.js`, `kiosk/qr`, `checkin/validate`, `api.js`)
Sistem harici Redis sunucusuna ihtiyaç duymadan tüm Kiosk durumunu PostgreSQL üzerinde atomik olarak yönetir:
1. **Fiziksel Kapı QR ve Oturum Dönüş Hafızası:** Öğrenciler yalnızca kapıdaki A4 posterde yer alan `?door=thku-study-room` parametresiyle Kiosk ekranını açabilir. Oturumu kapalı olan öğrenci QR okuttuğunda `sessionStorage` (`thku_kiosk_return_door`) kapı kodunu saklar ve giriş yapar yapmaz otomatik olarak Kiosk onay ekranına geri döndürür (`Kiosk.jsx` & `Login.jsx`).
2. **Kampüs Wi-Fi (`eduroam`), Mobil Veri ve Anti-VPN Denetimi (`verifyCampusNetworkAndVpn`):** Hücresel veri (`x-net-type: cellular`) ve kurumsal VPN alt ağları (`CAMPUS_VPN_PREFIX`) engellenir; `ENFORCE_CAMPUS_WIFI="true"` olduğunda THKÜ yerel Wi-Fi ve ULAKNET IP blokları doğrulanır.
3. **Opsiyonel Haversine GPS Yarıçapı (`ENFORCE_CAMPUS_GPS`):** Aktif edildiğinde kütüphane merkez koordinatlarına (`LIBRARY_LAT`, `LIBRARY_LNG`) olan mesafeyi Haversine formülüyle denetler.
4. **Gizli Sekme Korumalı Donanım Parmak İzi ve NAT Güvenli Cihaz Kilidi:**
   - `api.js` cihazın WebGL GPU modelini, ekran boyutunu, CPU çekirdek sayısını ve saat dilimini **FNV-1a Hash** ile özetleyerek `x-hardware-fp` başlığında gönderir; sahte/boş cihaz kimlikleri (`no-dev-id`, `dev_fallback_browser`, `no-hw`) `sanitizeDeviceId` ile ayıklanır.
   - Kampüs Wi-Fi (`eduroam`) NAT arkasındaki farklı öğrencilerin aynı genel IP nedeniyle birbirini yanlışlıkla kilitlememesi için `hwLockHash` ve `ipUaLockHash` yalnızca geçerli donanım parmak izi ile birlikte üretilir.
   - `finalizeKioskCheckIn` (`kioskStore.js`), PostgreSQL transaction'ı içinde ilgili `reservations` satırını `SELECT ... FOR UPDATE` ile kilitler; kişisel OTP jetonunu (`kiosk_qr_tokens`) tek kullanımlık tüketir, `kiosk_device_locks` tablosuna 4 saatlik (`14400 sn`) cihaz/donanım kilitlerini yazar, `kiosk_attendances` kaydını ekler ve 2. grup üyesi tamamladığında randevuyu atomik olarak `CHECKED_IN` statüsüne yükseltir.

### 5.2. Otonom Yaşam Döngüsü Motoru (`lifecycle.js`), Adil Ceza Servisi (`penaltyService.js`) ve "Walk-In" Zaman Motoru (`timeUtils.js`)
Her 30 saniyede bir çalışan arka plan yaşam döngüsü (`runReservationLifecycle`):
- **Gece Yarısı (`00:00`) ve Çok Günlü Tarama:** Dün ve bugünün aktif kayıtlarını birlikte tarayarak gece yarısını aşan randevuları kesintisiz izler ve geçmiş günlerde kalmış kayıtları da yakalar.
- **30 Dakika Grup Davet Süre Aşımı:** 30 dakika içinde en az 1 davetli tarafından onaylanmayan `PENDING` randevuları `CANCELLED` statüsüne çeker.
- **Adil No-Show Cezası (`verifiedUsers` vs `absentUsers`):** Başlangıçtan `+15 dakika` (`CHECKIN_TOLERANCE_MINUTES`) geçtiği halde en az 2 üye kapı QR okutmamışsa randevu `NO_SHOW` olur; kapıda QR okutmuş öğrenciye (`kiosk_attendances`) **kesinlikle ceza yazılmaz**, yalnızca gelmeyenlere `1/3` uyarı (`15 puan`) işlenir; `3/3` olan öğrenci **30 gün otomatik banlanır**.
- **Bitiş Saatinde Otomatik Tamamlama (`CONFIRMED` & `CHECKED_IN -> COMPLETED`):** Randevu bitiş saati geldiğinde (`nowEpochMins >= endEpochMins`) hem `CONFIRMED` hem de `CHECKED_IN` statüsündeki randevuları otomatik olarak `COMPLETED` durumuna geçirir (görevli tarafından `FORCE_CHECKIN` yapılmış randevularda öğrencilere haksız ceza uygulanmaz).
- **Walk-In Penceresi (`getKioskWindowEpochBounds`):** Boşa düşen odayı ara dakikada (`createdAt > startTime`) tutan yeni gruba `[createdAt, createdAt + 15 dk]` özel Kiosk onay penceresi tanımlar.

### 5.3. 6 Sekmeli Yönetim Paneli, Kurumsal Personel Yönetimi ve Test Verisi Temizliği (`AdminPanel.jsx`, `components/admin/*`, `handlers.js`)

| Sekme / Özellik | Frontend Bileşeni | Backend Aksiyonu (`handlers.js`) | Yetkili Roller ve Fonksiyonel Özeti |
| :--- | :--- | :--- | :--- |
| **Sekme 1: Analitik & A4 PDF Rapor** | `AnalyticsTab.jsx` | `GET /api/admin/manage` | Gelecek 1 saat radarı, 24 saatlik yoğunluk grafiği, bölüm/iptal analizleri, 7x24 Isı Haritası ve A4 PDF faaliyet raporu (`window.print()`). |
| **Sekme 2: Canlı Rezervasyonlar** | `ReservationsTab.jsx` | `RESERVATION_OP` (`FORCE_CHECKIN`, `EARLY_FINISH`, `MARK_NO_SHOW`, `CANCEL`) | Aktif randevu operasyonları; `isReservationEnded` kontrolü ile süresi biten randevular anında geçmiş görünümüne ayrılır. |
| **Sekme 3: Oda Yönetimi** | `RoomsTab.jsx` | `CREATE_ROOM`, `UPDATE_ROOM`, `DELETE_ROOM`, `TOGGLE_ROOM` | Oda ekleme, kapasite düzenleme ve mevcut randevuları bozmadan bakım moduna alma. |
| **Sekme 4: Duyuru Merkezi** | `AnnouncementsTab.jsx` | `CREATE_ANNOUNCEMENT`, `DELETE_ANNOUNCEMENT` | Çift dilli (`TR`/`EN`) öncelikli kütüphane duyuruları. |
| **Sekme 5: Kullanıcı & Personel Yönetimi** | `UsersTab.jsx` | `USER_MODERATION`, `CREATE_STAFF_ACCOUNT`, `RESET_STAFF_TEMP_PASSWORD`, `SET_USER_ACTIVE` | Ban/ceza yönetimi, `@thk.edu.tr` kurumsal görevli/yönetici hesabı açma, 72 saatlik geçici şifre üretme/kopyalama ve hesap Aktif/Pasif kilidi. |
| **Sekme 6: Kurallar, Loglar & Temizlik** | `RulesAndLogsTab.jsx` & `AdminPanel.jsx` | `UPDATE_RULE`, `PURGE_TEST_DATA` | 7 dinamik kural yönetimi, 180 günlük denetim logları ve `SUPER_ADMIN` için `@demo.local` test verilerini tek tıkla güvenli temizleme. |

---

## 6. Veritabanı Mimarisi (24 Modelli Prisma Şeması)

`backend/prisma/schema.prisma` toplam **24 ilişkisel tablo** içerir; Kiosk ve kurumsal kimlik doğrulama dahil tüm durum PostgreSQL üzerinde kalıcı ve atomik olarak tutulur:

| Model Adı | Temel Alanlar | Mimari Görevi |
| :--- | :--- | :--- |
| **`User`** | `role`, `isActive`, `passwordHash`, `mustChangePassword`, `tempPasswordExpiresAt`, `sessionVersion`, `penaltyPoints`, `isBanned`, `banUntil` | Öğrenci ve kurumsal personel kimlik, şifre, oturum versiyonu ve disiplin durumu |
| **`Room` & `Reservation`** | `reservationDate`, `startTime`, `endTime`, `status`, `checkedInAt`, `checkedInById`, `noShow`, `penaltyApplied` | Grup çalışma odaları ve randevu yaşam döngüsü durum makinesi |
| **`ReservationParticipant`** | `reservationId`, `userId`, `status` (`PENDING`, `ACCEPTED`, `REJECTED`) | Grup üyelerinin davet ve katılım onay kayıtları |
| **`KioskQrToken`** | `reservationId`, `userId`, `tokenHash` (`SHA-256`), `expiresAt` (`10 dk`) | Kapı QR okutulduğunda üretilen tek kullanımlık kişisel doğrulama jetonu |
| **`KioskAttendance`** | `reservationId`, `userId`, `verifiedAt` (`@@unique([reservationId, userId])`) | Kapıda fiziksel QR yoklamasını tamamlamış grup üyelerinin kalıcı kaydı |
| **`KioskDeviceLock`** | `reservationId`, `lockType` (`DEVICE`, `HARDWARE`, `IP_UA`), `lockKey`, `ownerUserId`, `expiresAt` (`4 saat`) | Gizli sekme ve çoklu hesap suistimalini önleyen 4 saatlik cihaz/donanım kilit tablosu |
| **`LoginRateLimit`** | `bucketKey` (`email:...` / `ip:...`), `failures`, `windowStart` (`10 dk`) | Kurumsal şifre girişinde kaba kuvvet (brute-force) saldırılarını engelleyen sayaç tablosu |
| **`PenaltyHistory` & `ReservationRule`** | `penaltyType`, `penaltyPoints`, `ruleName`, `ruleValue` | Adil `1/3 -> 3/3` No-Show ceza geçmişi ve 7 dinamik rezervasyon kuralı |
| **`SystemAgreement`, `Announcement`, `EmailQueue`, `AuditLog`, `AdminAction`** | Versiyonlu sözleşme, TR/EN duyuru, SMTP kuyruğu ve denetim izleri | Kurumsal uyumluluk, bildirim sürekliliği ve 180 günlük tam izlenebilirlik |

---

## 7. Bileşen Düzeyinde Teknik Dokümantasyon (61 Modül + Dağıtım Rehberi)

Projedeki tüm kaynak kod modülleri `# Context:` standardında [`frontend/docs/`](/frontend/docs/README.md) (**23 modül + 1 indeks = 24 dosya**), [`backend/docs/`](/backend/docs/README.md) (**37 modül + 1 indeks = 38 dosya**) ve [`deploy/README.md`](/deploy/README.md) altında eksiksiz belgelendirilmiştir. Otomatik test paketi (`npm test --prefix backend`) Kiosk atomikliğini ve kurumsal şifre güvenliğini 20 senaryoyla doğrular.

---

<div align="center">
  <sub>© 2026 <b>Kütüphane ve Dokümantasyon Daire Başkanlığı & Bilgi İşlem Müdürlüğü</b> • Geliştirici: <b>Bora Avcu</b></sub>
</div>
