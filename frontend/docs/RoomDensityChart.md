# Context: RoomDensityChart.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/components/dashboard/RoomDensityChart.jsx`, kütüphanedeki aktif çalışma odalarının bugünkü 24 saatlik dilim üzerinden doluluk yüzdelerini (`occupancyPercent`) ve genel ortalama yoğunluğu (`avgPct`) dikey sütun grafiği olarak görselleştiren analitik bileşendir. Yönetim Panelindeki (`AdminPanel.jsx` -> `AnalyticsTab.jsx`) **"Yoğunluk & Doluluk Analizi"** sekmesinde ve A4 PDF faaliyet raporunda yer alır.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material/BarChart`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **API İstemcisi:** `../../api` (`GET /api/dashboard/room-density`)

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Veri Normalizasyonu ve Ortalama Referans Çizgisi
- Bileşen yüklendiğinde `GET /api/dashboard/room-density` uç noktasından PostgreSQL veritabanındaki günlük oda doluluk verilerini (`bookedHours`, `totalHours: 24`, `occupancyPercent`) çeker ve normalize eder.
- Genel ortalama doluluk yüzdesi (`avgPct`), grafik üzerinde yatay kesikli referans çizgisi (`borderTop: '1.5px dashed'`) ve sağ üst köşede dinamik renkli özet rozet olarak gösterilir.

### B. Yoğunluk Renk Eşikleri ve A4 PDF Yazdırma Koruması
- **`getBarColor(pct)`:** `<%40` düşük yoğunluk için yeşil (`success.main`), `%40–%75` orta yoğunluk için turuncu (`warning.main`) ve `>=%75` yüksek yoğunluk için kırmızı (`error.main`) renk atar.
- **`@media print` Uyumluluğu:** A4 PDF faaliyet raporu çıktısında grafiğin sayfa ortasında bölünmemesi için `breakInside: 'avoid'` / `pageBreakInside: 'avoid'` ve sütun renklerinin korunması için `printColorAdjust: 'exact'` kuralları tanımlanmıştır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/components/admin/AnalyticsTab.jsx`
- `frontend/src/pages/AdminPanel.jsx`
- `backend/src/app/api/dashboard/room-density/route.js` (`GET`)
