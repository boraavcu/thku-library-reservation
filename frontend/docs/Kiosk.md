# Context: Kiosk.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`Kiosk.jsx`, sistemin fiziksel güvenlik ve yoklama doğrulama ekranıdır. Kullanıcının rolüne göre **iki farklı modda** çalışır:
1. **Yetkili Modu (`STAFF_POSTER`):** Kütüphane görevlisi veya müdürü `/kiosk` sayfasına girdiğinde, 4 çalışma odasının (`R101`–`R104`) kapısına asılacak olan **A4 boyutunda yazdırılabilir Resmi Kapı QR Posterini** üretir.
2. **Öğrenci Yoklama Modu (`STUDENT_ACTIVE`):** Öğrenci çalışma odasının kapısındaki fiziksel QR kodu (`/kiosk?door=thku-study-room`) cep telefonuyla okuttuğunda; GPS konumunu, Kampüs Wi-Fi ağını ve cihaz kilidini doğrulayarak **Tek Tıkla Oda Giriş Onayı (Check-In)** yapmasını sağlar.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Tarayıcı API:** `navigator.geolocation.getCurrentPosition` (Yüksek doğruluklu `enableHighAccuracy: true` GPS koordinat okuma) 
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`) 
- **Yönlendirme:** `react-router-dom` (`useNavigate`, `useSearchParams`) 
- **API İstemcisi:** `../api` (`GET /api/kiosk/qr` ve `POST /api/checkin/validate`) 

##  3. İş Mantığı ve Güvenlik Durumları (State & Verification Modes)

### A. GPS Koordinatlarının Alınması ve Durum Sorgusu
- Sayfa açıldığında kullanıcı yetkili (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) ise GPS beklenmeden doğrudan `GET /api/kiosk/qr` çağrılır ve `STAFF_POSTER` görünümü açılır.
- Kullanıcı öğrenci ise tarayıcıdan GPS izni istenir; alınan `lat` ve `lng` koordinatları ile URL'deki `door` parametresi `GET /api/kiosk/qr?door=...&lat=...&lng=...` uç noktasına gönderilir.

### B. Backend'den Dönen 5 Öğrenci Durumu (`kioskData.mode`)
1. **`DOOR_QR_REQUIRED`:** Öğrenci kapıdaki QR kodu okutmak yerine doğrudan menüden veya adres çubuğundan `/kiosk` yazarak girdiyse engellenir . *(Geliştirme ortamında `import.meta.env.DEV` aktifken test kolaylığı için `[Geliştirici Testi] Kapı QR Okutulmuş Gibi Aç` butonu görünür; canlıda otomatik gizlenir)*.
2. **`LOCATION_BLOCKED`:** Öğrenci Kampüs Wi-Fi (`eduroam` / `THKU-802.1x`) ağında değilse, hücresel veri veya VPN kullanıyorsa, kütüphane binasına 1 km'den uzaktaysa veya **aynı telefondan (gizli sekme dahil) başka bir öğrenci adına onay verilmeye çalışılıyorsa** kırmızı güvenlik uyarısıyla engellenir.
3. **`STUDENT_NO_ACTIVE_BOOKING`:** Öğrencinin bugün için onaylanmış (`CONFIRMED` / `CHECKED_IN`) bir randevusu yoksa veya ±15 dk süresi geçtiği için otomatik iptal edildiyse bilgi verir.
4. **`OUTSIDE_TIME_WINDOW`:** Öğrencinin bugün randevusu varsa ancak şu anki saat randevunun `minAllowed – maxAllowed` (±15 dk) onay penceresi dışındaysa, hangi saatler arasında QR okutması gerektiğini net olarak gösterir.
5. **`STUDENT_ACTIVE`:** Tüm güvenlik ve zaman kontrolleri geçilmiştir. Ekranda oda adı, geçerli onay penceresi (`windowLabel`), grup yoklama ilerleme çubuğu (`checkedCount / totalCount`), gruptaki tüm üyelerin anlık onay durumu (`Onayladı ✓` / `Bekleniyor...`) ve Redis'te üretilen tek kullanımlık `personalSessionToken` ile çalışan **"Oda Girişimi Onayla (Check-In)"** butonu gösterilir.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/kiosk/qr/route.js` (`GET`) 
- `backend/src/app/api/checkin/validate/route.js` (`POST`) 
- `frontend/src/api.js` (Cihaz ve donanım parmak izi başlıkları) 