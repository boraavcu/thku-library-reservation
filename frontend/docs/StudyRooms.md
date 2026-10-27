# Context: StudyRooms.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`StudyRooms.jsx`, öğrencilerin kütüphanedeki aktif grup çalışma odalarını (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) incelediği, tarih/süre/saat kriterlerine göre filtreleme yaptığı ve rezervasyon sihirbazına (`/reserve/new`) geçiş yaptığı oda seçim ekranıdır.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`) 
- **Yönlendirme:** `react-router-dom` (`useNavigate`) 
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN`) 
- **API İstemcisi:** `../api` (`GET /api/reserve/init`) 

##  3. İş Mantığı, Dinamik Kurallar ve Ban Koruması

### A. Dinamik Kural Entegrasyonu (`/api/reserve/init`)
- Sayfa açıldığında `GET /api/reserve/init` uç noktasından hem aktif odalar (`rooms`) hem de yöneticinin belirlediği dinamik kurallar (`rules`) çekilir.
- **İleri Tarih Sınırı (`maxDate`):** Yöneticinin `MAX_ADVANCE_DAYS` kuralında belirlediği gün sayısı (`rules?.maxAdvanceDays ?? 1`) bugünün tarihine (`Europe/Istanbul`) eklenerek tarih seçicinin (`<TextField type="date" />`) `max` sınırı dinamik olarak belirlenir.
- Sol paneldeki bilgilendirme kutusunda maksimum çalışma süresi (`rules?.maxDurationHours ?? 3`) ve maksimum oda kapasitesi (`rules?.maxParticipants ?? 8`) dinamik olarak yazdırılır .

### B. Bakımdaki Odaların Gizlenmesi ve Ban Koruması (`isBanned`)
- Yönetici panelinden yeni randevulara kapatılan (`isActive === false`) odalar listede gösterilmez (`rooms.filter(r => r.isActive !== false)`).
- **Banlı Öğrenci Koruması:** Oturumdaki `session?.user?.isBanned` değeri `true` ise, öğrenci odaları ve kapasitelerini salt okunur olarak görebilir ancak odaların yanındaki **"Seç" (`Select`)** butonu `disabled` durumuna geçer, ok ikonu gizlenir ve buton üzerinde *"Hesap Askıda / Suspended"* yazar.

##  4. Arayüz Düzeni (Responsive Sidebar & Room Cards)

- **Masaüstü (`md` ve üzeri):** Sol tarafta `280px` genişliğinde sabit (`sticky`) filtreleme paneli, sağ tarafta müsait oda kartları yer alır.
- **Mobil (`xs` ve `sm`):** Filtre paneli ekranı kaplamaması için açılır/kapanır `<Collapse in={filtersOpen}>` çekmecesine dönüşür.

##  5. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/reserve/init/route.js` (`GET`) 
- `frontend/src/pages/ReserveForm.jsx` (`/reserve/new?roomId=...&date=...` yönlendirmesi) 