# Context: ReserveForm.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`ReserveForm.jsx`, öğrencinin seçtiği oda için zaman aralığını belirlediği, grup arkadaşlarını kurumsal e-postalarıyla (`@stu.thk.edu.tr`) davet ettiği ve rezervasyonu onayladığı başvuru formudur.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Kütüphanesi:** `@mui/material` (`Container`, `Card`, `TextField`, `Chip`, `LinearProgress`, `Alert`)
- **Navigasyon:** `react-router-dom` (`useNavigate`, `useSearchParams`)
- **Oturum:** `next-auth/react` (`useSession`)
- **Tarih Modülü:** `../utils/dateUtils` (`getIstanbulNowInfo`, `toDateStr`)
- **API İstemcisi:** `../api` (`GET /api/reserve/init`, `POST /api/reservations`)

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

1. **Başlangıç Doğrulaması:** URL'den gelen `roomId` ve `date` parametreleri doğrulanır; `/api/reserve/init` çağrılarak odanın minimum ve maksimum grup büyüklükleri alınır.
2. **Organizatör Otomasyonu:** Giriş yapan öğrenci katılımcı listesinin 1. sırasına `"Organizatör"` rolüyle otomatik eklenir ve listeden silinemez (`rfCannotRemove`).
3. **Katılımcı Doğrulama:**
   - Eklenen e-postaların `s[öğrenciNo]@stu.thk.edu.tr` formatına uyduğu test edilir.
   - Toplam katılımcı sayısı odanın `minGroupSize` ve `maxGroupSize` sınırları arasındaysa form onay butonunu aktif hale getirir.
4. **Rezervasyon Gönderimi:** Form onaylandığında `/api/reservations` uç noktasına istek atılır; grup arkadaşlarına e-posta davetleri fırlatılır ve kullanıcı `/bookings` sayfasına yönlendirilir.

## 4. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/reservations/route.js`
- `backend/src/app/api/reserve/init/route.js`
- `frontend/src/pages/MyBookings.jsx`
