# Context: StudyRooms.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`StudyRooms.jsx`, öğrencilerin kütüphanedeki çalışma odalarını filtrelediği, saatlik müsaitlik durumlarını incelediği ve oda seçimi yaptığı ana keşif ve rezervasyon giriş sayfasıdır.

**Kritik Hata Düzeltmeleri:**
1. "Odayı Seç" butonunun yanlışlıkla `/reserve-form` rotasına yönlendirmesi düzeltilerek `App.jsx` ile tam uyumlu **`/reserve/new?roomId=${room.id}&date=${selectedDate}`** adresine yönlendirilmesi sağlandı.
2. Cezalı öğrenciler için buton kilidi (`disabled={isBanned}`) ve `"Hesap Askıda"` etiketi eklendi.
3. Takvim seçiciye sözleşmedeki `maxAdvanceDays` sınırını zorunlu kılan `maxSelectableDate` eklendi.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Kütüphanesi:** `@mui/material` (`Slider`, `TextField`, `Card`, `Chip`, `Button`), `@mui/icons-material`
- **Tarih Motoru:** `../utils/dateUtils` (`getIstanbulNowInfo`, `toDateStr`, `getFutureDateStr`)
- **API İstemcisi:** `../api` (`GET /api/rooms?date=...`)
- **Navigasyon:** `react-router-dom` (`useNavigate`)
- **Oturum:** `next-auth/react` (`useSession`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. Kesintisiz Boşluk Filtreleme Algoritması (`hasContinuousAvailableSlot`)
Kullanıcının seçtiği **Süre (`requiredDuration`: 1, 2 veya 3 saat)** ve **Saat Aralığı (`timeRange`: örn. 13:00 - 18:00)** filtrelerini odanın veritabanından gelen `occupiedSlots` verisiyle eşleştirir:
1. Oda pasifse (`!room.isActive`) doğrudan elenir.
2. Seçilen saat aralığında geçmiş saatler (bugünün geride kalan saatleri) elenir.
3. Seçilen aralıkta odanın dolu dilimleriyle çakışmayan, **kesintisiz en az `requiredDuration` saat uzunluğunda** boş bir zaman bloğu olup olmadığı test edilir. Blok yoksa oda listede gizlenir.

### B. Gerçek Zamanlı Oda Arama ve Kapasite Filtresi
- Oda adına veya numarasına göre canlı arama (`searchQuery`).
- Seçilen tarihe göre anında API'den odanın o günkü doluluk haritasının çekilmesi.

### C. Rezervasyon Formuna Güvenli Geçiş
Öğrenci "Odayı Seç" butonuna bastığında oda ID'si ve seçilen tarih URL sorgu parametreleriyle `/reserve/new` formuna taşınır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/ReserveForm.jsx`
- `backend/src/app/api/rooms/route.js`
- `frontend/src/utils/dateUtils.js`