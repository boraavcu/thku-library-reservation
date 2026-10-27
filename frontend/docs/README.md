#  THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi — Teknik Mimari ve Dokümantasyon Rehberi

Bu dizin, **Türk Hava Kurumu Üniversitesi (THKÜ) Kütüphane 7/24 Grup Çalışma Odaları Rezervasyon ve Kiosk Yoklama Sistemi**'nin tüm kaynak kod dosyalarını (`43/43`), iş kurallarını ve güvenlik katmanlarını açıklayan bileşen düzeyinde teknik dokümantasyonu içerir.

---

##  1. Çekirdek Mimari Prensipler

1. **7/24 Kesintisiz Hizmet ve Dinamik Kurallar:**
   - Kütüphane çalışma odaları (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) 00:00 – 24:00 saatleri arasında 7/24 hizmet verir.
   - Sistemdeki 7 temel parametre (`MIN_PARTICIPANTS: 2`, `MAX_PARTICIPANTS: 8`, `MAX_DURATION_HOURS: 3`, `MAX_ADVANCE_DAYS: 1`, `DAILY_RELEASE_HOUR: 8`, `CHECKIN_TOLERANCE_MINUTES: 15`, `CANCEL_LOCK_MINUTES: 60`) veritabanından dinamik olarak yönetilir.
2. **4 Katmanlı Fiziksel Kiosk Kapı QR Güvenliği:**
   - Öğrencilerin odaya giriş onayı (`Check-In`) verebilmesi için:
     1. Fiziksel kapı QR parametresi (`door=thku-study-room`),
     2. Kampüs Wi-Fi (`eduroam` / `THKU-802.1x`) IP doğrulaması ve Hücresel Veri / VPN engeli,
     3. Kütüphane merkezli **1 km sabit GPS yarıçapı** doğrulaması,
     4. **Gizli Sekme (Incognito) Korumalı Cihaz Kilidi** (`Cookie` + `localStorage` + `WebGL GPU Donanım Parmak İzi` + `IP/UA Hash`) katmanlarından geçmesi zorunludur.
3. **Adil No-Show Cezası ve Otomatik Oda Boşaltma (`lifecycle.js`):**
   - Grup davetleri **30 dakika** içinde en az 1 davetli tarafından onaylanmazsa randevu otomatik iptal edilir.
   - Randevu başlangıcından **±15 dakika** içinde en az 2 grup üyesi kapı QR kodunu okutmazsa randevu otomatik `NO_SHOW` olur ve oda takvimde anında diğer öğrencilere açılır.
   - Kapıda kendi üzerine düşeni yapıp QR okutmuş olan öğrenciye (`verifiedUsers`) **kesinlikle ceza yazılmaz**; yalnızca QR okutmayan üyelere (`absentUsers`) `1/3 No-Show` uyarısı işlenir. `3/3` olan öğrenci otomatik olarak **30 gün banlanır**.
4. **Boşa Düşen Odayı Ara Dakikada Anında Tutma (`Walk-In`):**
   - Normal randevuların (`createdAt <= startTotalMins`) Kiosk penceresi sabit `start ± 15 dk` (örn: `15:45 – 16:15`) aralığındadır.
   - İlk grup gelmediği veya erken boşalttığı için ara dakikada (örn: `16:20`'de) boşa düşen bir odayı aynı saat dilimi (`16:00 – 18:00`) için sıfırdan tutan yeni gruba (`createdAt > startTotalMins`), oluşturulma anından itibaren 15 dakika (`16:20 – 16:35`) Kiosk onay penceresi tanımlanır.

---

##  2. Tüm Dokümanların Dizin Haritası (43 / 43)

###  A. Frontend Dokümanları (`frontend/docs/` — 18 Dosya)
- **Sayfalar (`pages/`):**
  1. `Dashboard.md` — Öğrenci ana kontrol paneli, No-Show rozeti ve duyuru merkezi
  2. `AdminPanel.md` — 6 sekmeli yönetim, analitik, A4 PDF faaliyet raporu, ban ve log merkezi
  3. `ReserveForm.md` — 2 aşamalı tarih/saat ve katılımcı ekleme sihirbazı
  4. `Kiosk.md` — A4 Kapı QR Posteri (Yetkili) ve GPS/Wi-Fi kapı yoklama ekranı (Öğrenci)
  5. `MyBookings.md` — Aktif/geçmiş randevular, erken boşaltma ve iptal kilidi yönetimi
  6. `StudyRooms.md` — Çalışma odaları listesi ve dinamik tarih/kapasite filtreleme
  7. `Profile.md` — Microsoft Azure AD fotoğraf senkronizasyonu ve acil durum telefonu
  8. `RulesAcceptance.md` — 6 maddelik TR/EN zorunlu sözleşme onay ekranı
  9. `Login.md` — Microsoft SSO ve `.env` kontrollü güvenli demo giriş kapısı
- **Bileşenler ve Altyapı (`components/` & `src/`):**
  10. `Navbar.md` — Rol duyarlı üst menü ve interaktif bildirim merkezi
  11. `Footer.md` — Kurumsal alt bilgi ve geliştirici rozeti
  12. `RoomDensityChart.md` — 24 saatlik oda yoğunluk sütun grafiği
  13. `api.md` — WebGL donanım parmak izi ve ağ tipi enjekte eden Axios istemcisi
  14. `App.md` — Ana yönlendirme ağacı ve alt alan adı koruması
  15. `i18n.md` — Türkçe ve İngilizce tam kapsamlı çeviri sözlüğü
  16. `main.md` — Sağlayıcı (Provider) sarmalayıcıları ve DOM giriş noktası
  17. `theme.md` — Kurumsal MUI renk paleti ve tipografi sistemi
  18. `formatTime.md` — TR/EN göreceli zaman formatlayıcısı

###  B. Backend Dokümanları (`backend/docs/` — 25 Dosya)
- **Çekirdek Kütüphaneler ve Veritabanı (`lib/`, `prisma/`, `middleware`):**
  19. `lifecycle.md` — Otomasyon zamanlayıcısı, adil ceza motoru ve kurumsal HTML e-posta merkezi
  20. `schema.prisma.md` — 20 modelli PostgreSQL veritabanı şeması
  21. `seed.cjs.md` — Zengin analitik demo ve canlı başlangıç veri betiği
  22. `db.md` — Prisma Client singleton bağlantısı
  23. `redis.md` — Redis bağlantısı ve Kiosk/cihaz kilidi anahtar mimarisi
  24. `middleware.md` — `panel.library.thk.edu.tr` Edge yetki duvarı
  25. `checkRulesAcceptance.md` — Güncel sözleşme versiyon doğrulama ara katmanı
  26. `layout-and-page.md` — Next.js App Router kök şablon dosyaları
- **API Uç Noktaları (`app/api/**/route.js`):**
  27. `admin-manage.md` — Yönetim paneli analitik (`GET`) ve 8 idari operasyon (`POST`) merkezi
  28. `auth-nextauth.md` — Azure AD SSO, Demo giriş ve otomatik ban açma (`Auto-Unban`)
  29. `kiosk-qr.md` — 4 katmanlı Kiosk güvenlik denetimi ve OTP üretimi
  30. `checkin-validate.md` — Kiosk yoklama onayı, cihaz mühürleme ve 2. kişi oda açılış kuralı
  31. `reservations.md` — Rezervasyon oluşturma, erken boşaltma ve iptal kilidi servisi
  32. `reservations-active.md` — Öğrenci anasayfası aktif randevu sorgusu
  33. `invitations.md` — Bekleyen grup davetleri sorgusu
  34. `invitations-respond.md` — Davet kabul/red ve `PENDING -> CONFIRMED` geçiş servisi
  35. `rooms.md` — Aktif çalışma odaları listeleme servisi
  36. `rooms-availability.md` — Gerçek zamanlı oda müsaitlik ve dolu saat dilimi servisi
  37. `reserve-init.md` — Aktif odalar ve 7 dinamik kural başlangıç servisi
  38. `dashboard-room-density.md` — 24 saatlik oda yoğunluk hesaplama servisi
  39. `announcements.md` — Aktif duyuru listeleme servisi
  40. `profile.md` — Profil görüntüleme ve `PHONE_REGEX` doğrulamalı telefon güncelleme
  41. `agreements-active.md` — Aktif kullanıcı sözleşmesi sorgusu
  42. `user-accept-rules.md` — Kullanıcı sözleşmesi onay mühürleme servisi
  43. `README.md` — Genel sistem mimarisi ve dokümantasyon indeks rehberi