# Context: StudyRooms.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/StudyRooms.jsx`, öğrencilerin kütüphanedeki grup çalışma odalarını (`R101`–`R104` ve yeni eklenen odalar) tarih, saat aralığı, kesintisiz çalışma süresi ve minimum kapasite kriterlerine göre filtrelediği ve rezervasyon sihirbazına (`/reserve/new`) geçiş yaptığı oda keşif ekranıdır.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material` — `Slider`, `TextField`, `Card`, `Chip`, `Button`, `CircularProgress`, `InputAdornment`; `@mui/icons-material`)
- **Kimlik Doğrulama & Yönlendirme:** `next-auth/react` (`useSession`), `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **Zaman & API Yardımcıları:** `../utils/dateUtils` (`getIstanbulNowInfo`, `toDateStr`), `../api` (`GET /api/rooms?date=...`)
- **Alt Bileşenler:** `../components/Navbar`, `../components/Footer`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Kesintisiz Boş Zaman Dilimi Algoritması (`hasContinuousAvailableSlot`)
Kullanıcının seçtiği **Tarih (`selectedDate`)**, **Saat Aralığı (`timeRange`: `00:00`–`24:00`)** ve **Süre (`duration`: `1`, `2` veya `3` saat)** filtrelerini PostgreSQL veritabanından çekilen `occupiedSlots` bloklarıyla karşılaştırır:
1. Oda bakımdaysa (`!room.isActive`) veya seçilen tarih geçmişteyse `false` döner.
2. Bugün (`selectedDate === todayStr`) için Türkiye saatine (`nowMinutes`) göre geride kalmış saat dilimlerini eler (`23:59` bitiş saatini `24:00` olarak normalize eder).
3. Seçilen saat aralığı içinde dolu dilimlerle çakışmayan **kesintisiz en az `requiredDuration` saatlik** boş bir blok bulunup bulunmadığını doğrular.

### B. Dinamik Tarih Sınırı, Kapasite Filtresi ve Ban Koruması
- Sunucudan dönen `maxAdvanceDays` kuralına göre takvim seçicisinin üst sınırı (`maxSelectableDate`) dinamik olarak kısıtlanır.
- Oda adı/kodu araması (`searchQuery`) ve `2+`, `4+`, `6+`, `8+` minimum kapasite butonlarıyla anlık istemci filtrelemesi yapılır.
- Yasaklı (`isBanned === true`) öğrenciler için **"Odayı Seç"** butonu devre dışı bırakılır ve *"Hesap Askıda / Account Suspended"* etiketi gösterilir; uygun kullanıcılar ise `/reserve/new?roomId=${room.id}&date=${selectedDate}` rotasına yönlendirilir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/ReserveForm.jsx`
- `frontend/src/utils/dateUtils.js` (`getIstanbulNowInfo`, `toDateStr`)
- `frontend/src/components/Navbar.jsx` & `Footer.jsx`
- `backend/src/app/api/rooms/route.js` (`GET`)
