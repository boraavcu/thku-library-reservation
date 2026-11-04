# THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi — Backend (API & Otomasyon Sunucusu)

Bu dizin, **Türk Hava Kurumu Üniversitesi (THKÜ) Kütüphane Grup Çalışma Odaları Rezervasyon ve Kiosk Yoklama Sistemi**'nin Headless RESTful API uç noktalarını, otonom yaşam döngüsü zamanlayıcısını, Kiosk kapı güvenliğini ve kurumsal kimlik doğrulama katmanını barındıran Next.js 16 (App Router) sunucu uygulamasıdır.

---

## 1. Mimari Genel Bakış ve Temel Yetenekler

- **PostgreSQL 16 & Prisma ORM:** Harici önbellek servisi (Redis vb.) gerektirmeden tüm Kiosk OTP (`kiosk_qr_tokens`), kapı yoklama kayıtları (`kiosk_attendances`), 4 saatlik cihaz/donanım kilitleri (`kiosk_device_locks`) ve kaba kuvvet hız sınırlamaları (`login_rate_limits`) doğrudan PostgreSQL üzerinde `SELECT ... FOR UPDATE` atomik satır kilitleriyle yönetilir.
- **Çift Kanallı Kimlik Doğrulama:**
  - **Microsoft Entra ID (Azure AD) SSO:** Öğrenciler (`@stu.thk.edu.tr`) ve Microsoft hesaplı personel için tek tıkla kurumsal giriş, otomatik profil eşitleme ve süresi dolan disiplin cezalarını giriş anında kaldırma (`Auto-Unban`).
  - **Kurumsal `@thk.edu.tr` Personel Girişi:** Kütüphane görevlileri ve yöneticiler için `scrypt` (`N=16384`) şifre güvenliği, 72 saatlik tek gösterimlik geçici şifreler, ilk girişte zorunlu şifre değişimi (`mustChangePassword`), `sessionVersion` ile anında eski oturumları iptal etme ve IP/e-posta bazlı kaba kuvvet (brute-force) koruması.
- **Otonom Yaşam Döngüsü Zamanlayıcısı (`src/lib/lifecycle.js`):** Her 30 saniyede bir arka planda çalışarak süresi dolan onaylanmamış davetleri (`PENDING`) iptal eder, başlangıçtan `+15 dk` sonra gelmeyen gruplara adil No-Show cezası işler (`verifiedUsers` hariç tutulur, `3/3` olan 30 gün banlanır), süresi dolan `CONFIRMED` ve `CHECKED_IN` randevuları otomatik `COMPLETED` durumuna geçirir ve 2 saat öncesi e-posta hatırlatmalarını gönderir.
- **4 Katmanlı Kiosk Doğrulaması (`src/lib/kioskSecurity.js` & `src/lib/kioskStore.js`):** İmzalı kapı QR parametresi (`?door=thku-study-room`), Kampüs Wi-Fi (`eduroam`) & VPN/hücresel engeli, opsiyonel Haversine GPS mesafesi ve gizli sekme (Incognito) korumalı WebGL GPU + IP/UA 4 saatlik PostgreSQL cihaz kilidi.
- **`/randevu` Alt Dizin Desteği (`src/lib/publicPaths.js`):** Apache ters vekil mimarisi altında e-postalardaki ve oturum çerezlerindeki bağlantıları `/randevu` önekiyle uyumlu biçimde üretir.

---

## 2. Dizin Yapısı

```text
backend/
├── prisma/
│   ├── schema.prisma              # 24 Modelli İlişkisel Veritabanı Şeması
│   ├── migrations/                # 8 Adet Kümülatif SQL Migration Dosyası
│   └── seed.cjs                   # Demo ve Başlangıç Veri Tohumlama Betiği
├── src/
│   ├── app/
│   │   └── api/                   # RESTful API Uç Noktaları (18 Adet Route)
│   │       ├── account/password/  # Kurumsal personel şifre güncelleme (POST)
│   │       ├── admin/manage/      # Analitik GET & İdari Aksiyonlar POST (handlers.js)
│   │       ├── admin/set-role/    # SUPER_ADMIN rol atama uç noktası (POST)
│   │       ├── agreements/active/ # Aktif sözleşme versiyon sorgusu (GET)
│   │       ├── announcements/     # Kütüphane duyuruları (GET)
│   │       ├── auth/[...nextauth]/# NextAuth Azure AD + Credentials sağlayıcıları
│   │       ├── checkin/validate/  # Kiosk kapı yoklama onayı (POST)
│   │       ├── dashboard/room-density/ # 24 saatlik oda doluluk oranları (GET)
│   │       ├── invitations/       # Grup davetleri listeleme (GET)
│   │       ├── invitations/respond/ # Davet kabul/red servisi (POST)
│   │       ├── kiosk/qr/          # Kiosk QR ön doğrulama, poster & OTP (GET)
│   │       ├── profile/           # Profil bilgisi ve telefon güncelleme (GET, PATCH)
│   │       ├── reservations/      # Randevu oluşturma, listeleme, erken bitirme, iptal
│   │       ├── reservations/active/ # Aktif/yaklaşan randevu kartları (GET)
│   │       ├── reserve/init/      # Odalar ve 7 dinamik rezervasyon kuralı (GET)
│   │       ├── rooms/             # Aktif odalar ve dolu saat dilimleri (GET)
│   │       ├── rooms/[id]/availability/ # Seçilen oda için müsaitlik sorgusu (GET)
│   │       └── user/accept-rules/ # Kullanıcı sözleşme onayı (POST)
│   ├── lib/                       # SOLID Çekirdek Servis Katmanı
│   │   ├── db.js                  # DATABASE_URL değişim duyarlı Prisma singleton
│   │   ├── timeUtils.js           # Europe/Istanbul saati, UTC ve Kiosk pencere motoru
│   │   ├── publicPaths.js         # /randevu alt dizin URL üreticisi
│   │   ├── reservationPolicy.js   # 7 Dinamik kural, kota ve gece/sabah kuralı
│   │   ├── kioskSecurity.js       # Wi-Fi, GPS ve WebGL donanım parmak izi güvenliği
│   │   ├── kioskStore.js & kioskSql.mjs # PostgreSQL FOR UPDATE Kiosk durum deposu
│   │   ├── staffAccount.js & staffAuth*.mjs # Kurumsal şifre (scrypt) ve hesap servisi
│   │   ├── staffMail.js           # Geçici şifre SMTP gönderim yardımcısı
│   │   ├── loginRateLimit.js      # PostgreSQL tabanlı 10 dk brute-force koruması
│   │   ├── passwordGate.js        # Zorunlu şifre değişimi ve aktif oturum kapısı
│   │   ├── testData.js            # @demo.local test verilerini güvenli temizleme
│   │   ├── emailService.js        # HTML e-posta şablon motoru ve SMTP kuyruğu
│   │   ├── penaltyService.js      # Adil No-Show (1/3 -> 3/3) ve ban servisi
│   │   └── lifecycle.js           # 30 saniyelik otonom zamanlayıcı ve durum makinesi
│   ├── middleware/
│   │   └── checkRulesAcceptance.js# Oturum, şifre ve sözleşme kontrol ara katmanı
│   └── middleware.js              # Edge JWT panel koruma güvenlik duvarı
├── test/                          # Kiosk atomiklik ve personel şifre testleri (20 test)
└── docs/                          # 38 Adet Kapsamlı Teknik Modül Dokümanı
```

---

## 3. Kurulum ve Çalıştırma

### A. Bağımlılıkların Yüklenmesi
```bash
cd backend
npm install
```

### B. Veritabanı Şeması ve Başlangıç Verileri
```bash
# Prisma istemcisini oluşturun
npx prisma generate

# Bekleyen migration'ları uygulayın (sıfır veri kaybı)
npx prisma migrate deploy

# Geliştirme ortamı için demo odaları ve kullanıcıları tohumlayın
npm run seed
```

### C. Otomatik Testlerin Çalıştırılması
Kiosk eşzamanlı yoklama yarış durumlarını ve kurumsal personel şifre güvenliğini test etmek için:
```bash
npm test
```
*(Toplam 20 birim ve entegrasyon testi çalışır: `test/kiosk-atomicity.mjs` ve `test/staff-account.test.mjs`.)*

### D. Geliştirme Sunucusunu Başlatma
```bash
npm run dev
```
Sunucu varsayılan olarak **`http://localhost:3000`** adresinde açılır.

### E. Üretim Derlemesi ve Başlatma
```bash
npm run build
npm run start
```
*(Canlı Windows sunucu ortamında PM2 ile çalıştırma adımları için [🚀 `deploy/README.md`](../deploy/README.md) kılavuzuna bakın.)*

---

## 4. Detaylı Teknik Dokümantasyon

Backend mimarisindeki her bir servis, API ucu ve veri modelinin bileşen düzeyindeki `# Context:` dokümanları için [📘 Backend Dokümantasyon İndeksi (`backend/docs/README.md`)](./docs/README.md) dosyasını inceleyin.
