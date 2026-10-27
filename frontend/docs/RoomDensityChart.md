# Context: RoomDensityChart.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`RoomDensityChart.jsx`, kütüphanedeki aktif çalışma odalarının (`R101`–`R104`) bugünkü 24 saatlik dilim üzerinden doluluk yüzdelerini (`occupancyPercent`) ve genel ortalama yoğunluğu (`avgPct`) dikey sütun grafiği olarak görselleştiren analitik bileşendir. Yönetim Panelindeki (`AdminPanel.jsx`) **"Yoğunluk & Doluluk Analizi"** sekmesinde ve A4 PDF faaliyet raporunda kullanılır.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material/BarChart`)
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN`)
- **API İstemcisi:** `../../api` (`GET /api/dashboard/room-density`)

##  3. İş Mantığı, Renk Kodlaması ve PDF Yazdırma Uyumluluğu

### A. Veri Normalizasyonu ve Ortalama Hesabı
- Bileşen yüklendiğinde `GET /api/dashboard/room-density` uç noktasından her odanın bugün kaç saat dolu olduğu (`bookedHours`), toplam açık saat (`totalHours: 24`) ve doluluk yüzdesi (`occupancyPercent`) çekilir.
- Ortalama doluluk yüzdesi (`avgPct`) grafik üzerinde yatay kesikli bir referans çizgisi (`borderTop: '1.5px dashed'`) ve sağ üstte renkli bir özet rozet (`Ort: %X`) olarak gösterilir.

### B. Dinamik Yoğunluk Renk Eşikleri (`getBarColor`)
Sütunların ve rozetin rengi doluluk oranına göre otomatik değişir:
- **Düşük Yoğunluk (`<%40`):** Yeşil (`theme.palette.success.main`)
- **Orta Yoğunluk (`%40 – %75`):** Turuncu (`theme.palette.warning.main`)
- **Yüksek Yoğunluk (`>=%75`):** Kırmızı (`theme.palette.error.main`)

### C. A4 PDF Faaliyet Raporu Koruması (`@media print`)
- Yönetim panelinden PDF çıktısı alınırken grafiğin sayfa geçişinde ortadan ikiye bölünmemesi için ana `<Card>` bileşeninde `breakInside: 'avoid'` ve `pageBreakInside: 'avoid'` kuralları tanımlanmıştır.
- Ayrıca tarayıcının yazdırma sırasında sütun renklerini silmemesi için `WebkitPrintColorAdjust: 'exact'` ve `printColorAdjust: 'exact'` özellikleri eklenmiştir.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/dashboard/room-density/route.js` (`GET`)
- `frontend/src/pages/AdminPanel.jsx`