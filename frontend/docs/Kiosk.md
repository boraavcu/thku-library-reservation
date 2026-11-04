# Context: Kiosk.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/Kiosk.jsx`, çalışma odalarının fiziksel kapı giriş doğrulamasını ve yoklama güvenliğini yöneten çift modlu ekrandır:
1. **Yetkili Modu (`STAFF_POSTER`):** Kütüphane görevlisi, müdür veya sistem yöneticisi (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) `/kiosk` rotasına girdiğinde 4 çalışma odasının (`R101`–`R104`) kapısına asılacak **A4 boyutunda yazdırılabilir Resmi Kapı QR Posterini** oluşturur.
2. **Öğrenci Yoklama Modu (`STUDENT_ACTIVE`):** Öğrenci çalışma odasının kapısındaki QR kodu (`/randevu/kiosk?door=thku-study-room`) cep telefonuyla okuttuğunda Kampüs Wi-Fi ağını, GPS konumunu ve PostgreSQL tabanlı cihaz kilidini doğrulayarak **Tek Tıkla Oda Giriş Onayı (Check-In)** vermesini sağlar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Tarayıcı API'leri:** `navigator.geolocation.getCurrentPosition` (`enableHighAccuracy: true`), `sessionStorage` (`thku_kiosk_return_door`), `window.print()`
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`)
- **Yönlendirme:** `react-router-dom` (`useNavigate`, `useSearchParams`)
- **API İstemcisi:** `../api` (`GET /api/kiosk/qr` ve `POST /api/checkin/validate`)

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Oturumsuz Kapı QR Okutma ve Otomatik Dönüş Hafızası (`thku_kiosk_return_door`)
- Oturumu açık olmayan (`status === 'unauthenticated'`) bir öğrenci kapıdaki QR kodu okuttuğunda URL'deki `door` parametresi `sessionStorage.setItem('thku_kiosk_return_door', rawDoorParam)` ile kaydedilir ve kullanıcı `/` giriş sayfasına yönlendirilir.
- Öğrenci giriş yaptığında (ve ilk girişiyse kuralları onayladığında) `Login.jsx`, `RulesAcceptance.jsx` ve `Dashboard.jsx` bu anahtarı okuyarak kullanıcıyı otomatik olarak `/kiosk?door=...` ekranına geri döndürür; `Kiosk.jsx` oturum açıldığını gördüğünde anahtarı temizler ve yoklama sorgusunu başlatır.

### B. GPS Konumu (`ENFORCE_CAMPUS_GPS`) ve Durum Sorgusu
- Kullanıcı yetkili (`isStaff`) ise GPS beklenmeden doğrudan `GET /api/kiosk/qr` çağrılır ve A4 poster görünümü (`STAFF_POSTER`) açılır.
- Kullanıcı öğrenci ise tarayıcıdan GPS koordinatları (`lat`, `lng`) istenir ve `GET /api/kiosk/qr?door=...&lat=...&lng=...` uç noktasına iletilir. Sunucuda `ENFORCE_CAMPUS_GPS` ayarı kapalıysa dönen `kioskData.gpsOptional` bayrağı sayesinde üst bilgi çipinde **"GPS Opsiyonel"**, izin verildiğinde ise **"GPS Doğrulandı"** gösterilir.

### C. PostgreSQL Tabanlı OTP/Yoklama Durumları ve Detaylı Hata Gösterimi
Backend doğrulamasından dönen `kioskData.mode` değerine göre 5 durum yönetilir ve sunucudan gelen detaylı hata mesajları (`kioskData.error` / `err.response?.data?.error`) doğrudan `<Alert>` bileşeninde sunulur:
1. **`DOOR_QR_REQUIRED`:** Kapıdaki QR kod okutulmadan doğrudan `/kiosk` adresine girildiğinde engellenir *(yalnızca `import.meta.env.DEV` geliştirme modunda test butonu görünür)*.
2. **`LOCATION_BLOCKED`:** Kampüs Wi-Fi dışı bağlantı, kampüs mesafe sınırı aşımı veya PostgreSQL `kiosk_device_locks` tablosu üzerinden tespit edilen **aynı cihazdan (gizli sekme dahil) başka bir öğrenci adına yoklama verme** girişimleri engellenir.
3. **`STUDENT_NO_ACTIVE_BOOKING`:** Öğrencinin o gün için aktif (`CONFIRMED` / `CHECKED_IN`) bir rezervasyonu bulunmadığında bilgilendirir.
4. **`OUTSIDE_TIME_WINDOW`:** Randevunun `±15` dakikalık (`CHECKIN_TOLERANCE_MINUTES`) onay penceresi dışında okutma yapıldığında geçerli saat aralığını bildirir.
5. **`STUDENT_ACTIVE`:** Oda bilgisi, onay penceresi (`windowLabel`), grup yoklama ilerleme çubuğu (`checkedCount / totalCount`), üye bazlı onay durumu ve PostgreSQL `kiosk_qr_tokens` tablosunda üretilen tek kullanımlık `personalSessionToken` ile `POST /api/checkin/validate` çağrısı yapan **"Oda Girişimi Onayla (Check-In)"** butonu gösterilir.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/api.js` (`x-device-id`, `x-hardware-fp`, `x-net-type` başlıkları)
- `frontend/src/pages/Login.jsx`, `RulesAcceptance.jsx`, `Dashboard.jsx` (`thku_kiosk_return_door` yönlendirme zinciri)
- `backend/src/app/api/kiosk/qr/route.js` (`GET`)
- `backend/src/app/api/checkin/validate/route.js` (`POST`)
- `backend/src/lib/kioskStore.js` & `backend/src/lib/kioskSecurity.js` (PostgreSQL `kiosk_qr_tokens`, `kiosk_attendances` ve `kiosk_device_locks`)
