# Context: ReserveForm.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/ReserveForm.jsx`, öğrencinin seçtiği çalışma odası için iki aşamalı (`Step 1`: Görsel Saat Seçimi, `Step 2`: Çalışma Amacı, Katılımcı Ekleme ve Kural Onayı) grup rezervasyonu oluşturduğu sihirbaz ekranıdır.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama & Yönlendirme:** `next-auth/react` (`useSession`), `react-router-dom` (`useNavigate`, `useSearchParams`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **Zaman & API Yardımcıları:** `../utils/dateUtils` (`getIstanbulNowInfo`, `toDateStr`), `../api` (`GET /api/reserve/init`, `GET /api/rooms/:id/availability`, `POST /api/reservations`)
- **Alt Bileşen:** `../components/Navbar`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Başlangıç Kuralları ve 1. Adım: 7/24 Görsel Saat Çizelgesi (`step === 1`)
- Sayfa açılışında `GET /api/reserve/init` uç noktasından oda detayları ve PostgreSQL'deki dinamik sistem kuralları (`minParticipants`, `maxParticipants`, `maxDurationHours`, `maxAdvanceDays`, `checkinToleranceMinutes`, `cancelLockMinutes`) çekilir.
- Sol panelde `maxAdvanceDays` sınırına duyarlı 7 günlük hızlı tarih şeridi, sağ panelde ise `GET /api/rooms/${roomId}/availability?date=...` verisiyle beslenen `00:00 – 24:00` saatlik zaman çizelgesi yer alır.
- Geçmiş saatler (`isSlotPast`) ve dolu bloklar (`occupiedBlocks`) tıklamaya kapatılır; seçilen aralığın `maxDurationHours` sınırını aşmaması ve arada dolu saat barındırmaması `handleSlotClick` tarafından denetlenir. URL'den ön-seçili (`start`, `end`) gelen saatler çakışıyorsa otomatik sıfırlanır.

### B. 2. Adım: Çalışma Amacı, Katılımcı Yönetimi ve Kiosk Kural Onayı (`step === 2`)
- **Çalışma Amacı ve Hızlı Şablonlar:** Kullanıcı serbest metin girebilir veya `PURPOSE_PRESETS_TR` / `PURPOSE_PRESETS_EN` hazır konu çiplerinden (*Vize/Final Hazırlığı*, *Bitirme Projesi* vb.) tek tıkla seçim yapabilir.
- **Organizatör ve E-posta Doğrulaması:** Giriş yapan öğrenci 1. sıraya *Organizatör* olarak sabitlenir. `emailInput` alanına yazılan geçerli e-posta adresleri, kullanıcı "Ekle" butonuna basmayı unutsa dahi (`hasValidTypedEmail` / `effectiveParticipants`) otomatik olarak katılımcı listesine dahil edilir ve kapasite çubuğu (`LinearProgress`) anlık güncellenir.
- **Dinamik Kural Onayı ve Gönderim:** `checkinToleranceMinutes` ve `cancelLockMinutes` değerlerini içeren Kiosk yoklama kuralları kutucuğu (`rulesConfirmed`) işaretlenmeden ve katılımcı sayısı `[minParticipants, effectiveMax]` aralığında olmadan onay butonu aktifleşmez.
- `POST /api/reservations` çağrısında `409` çakışma hataları (`rfOverlap`) veya sistemde kayıtlı olmayan e-postalar (`missingEmails` çipleriyle) kullanıcıya gösterilir; başarılı kayıtta bildirim gösterilerek `/dashboard` ekranına yönlendirilir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx`
- `frontend/src/utils/dateUtils.js` (`getIstanbulNowInfo`, `toDateStr`)
- `frontend/src/components/Navbar.jsx`
- `backend/src/app/api/reserve/init/route.js` (`GET`)
- `backend/src/app/api/rooms/[id]/availability/route.js` (`GET`)
- `backend/src/app/api/reservations/route.js` (`POST`)
