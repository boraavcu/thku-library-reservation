# Context: seed.cjs

##  1. Dosyanın Amacı ve Mimari Rolü

`seed.cjs`, veritabanını tek komutla (`node prisma/seed.cjs`) sıfırlayıp THKÜ Kütüphane Sistemi'nin tüm özelliklerini, grafiklerini, ısı haritasını, ceza/ban senaryolarını ve Kiosk yoklama akışlarını test etmeye hazır hale getiren **Zengin Analitik Başlangıç Veri (Seed) Betiğidir**.

##  2. Yüklenen Veri Setleri ve Özel Mühendislik Kurguları

1. **3 Yetkili Hesabı (`SUPER_ADMIN`, `ADMIN`, `LIBRARIAN`):**
   - `bim.demo@demo.local` (`SUPER_ADMIN` - Bilgi İşlem Müdürlüğü)
   - `boraa-35@hotmail.com` (`ADMIN` - Kütüphane Müdürü; gerçek e-posta bildirimlerini alan hesap)
   - `gorevli.demo@demo.local` (`LIBRARIAN` - Kütüphane Görevlisi)
2. **18 Öğrenci ve Güvenli E-Posta Kurgusu:**
   - **Öğrenci 1 (`s250444902@stu.thk.edu.tr`):** Gerçek e-posta bildirimlerini test etmek için kullanılan ana öğrenci hesabıdır.
   - **Öğrenci 2 – 18 (`@demo.local`):** Farklı mühendislik ve havacılık bölümlerine dağılmış 17 demo öğrencidir.
   - **Özel Test Profilleri:**
     - `Caner Aydın (Öğrenci 5)`: `30 ceza puanı` ve `2/3 No-Show` uyarısıyla **ban sınırında** olan öğrenci (1 kez daha No-Show aldığında 3/3 otomatik ban testini sağlar).
     - `Hakan Yavuz (Öğrenci 18)`: `45 ceza puanı` ve `3/3 No-Show` ihlaliyle **25 gün banlı (`isBanned: true`)** öğrenci (Arayüzdeki ban uyarı bandını ve kilitli butonları test etmeyi sağlar).
3. **4 Çalışma Odası (`R101` – `R104`):**
   - `R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal` (8'er kişilik kapasiteyle).
4. **Aktif Sözleşme (`v1.0`) ve 7 Dinamik Kural:**
   - 6 maddelik güncel kullanım sözleşmesini ve 7 rezervasyon kuralını (`MIN_PARTICIPANTS: 2`, `MAX_PARTICIPANTS: 8`, `MAX_DURATION_HOURS: 3`, `MAX_ADVANCE_DAYS: 1`, `DAILY_RELEASE_HOUR: 8`, `CHECKIN_TOLERANCE_MINUTES: 15`, `CANCEL_LOCK_MINUTES: 60`) oluşturur.
5. **Dinamik Saatli Rezervasyon Veri Seti ve `createdAt` Ayrımı:**
   - Son 6 günün (`dayOffset: -6` .. `-1`) tamamlanmış ve No-Show randevularını oluşturarak yönetim panelindeki ısı haritasını ve bölüm grafiklerini doldurur.
   - **Bugün (`dayOffset: 0`):** İçinde bulunulan saate (`nowHour`) göre Öğrenci 1 için kapı QR testine hazır `CONFIRMED` randevu, R102'de şu an aktif `CHECKED_IN` grup ve Caner için `3/3` oto-ban test randevusu oluşturur.
   - **Kritik `createdAt` Kuralı:** Yarınki `PENDING` grup davetine 30 dakikalık onay süresi hemen dolmasın diye `createdAt: new Date()` verilirken, bugünkü onaylı (`CONFIRMED`) randevulara `createdAt: 2 saat öncesi` verilir; böylece sistem bu randevuları sonradan tutulmuş oda sanıp Kiosk süresini kaydırmaz.

##  3. Bağlantılı Olduğu Dosyalar

- `backend/prisma/schema.prisma`
- `backend/src/lib/lifecycle.js`