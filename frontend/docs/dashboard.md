# Context: Dashboard.jsx

## 1. Dosyanın Amacı ve Rolü

`Dashboard.jsx`, **THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi**'nin öğrenci ana kontrol panelidir. Kullanıcı kurumsal Microsoft (Azure AD) hesabıyla giriş yapıp aktif kullanıcı sözleşmesini (`acceptedAgreementVersion`) onayladıktan sonra karşılaştığı ilk ekrandır. Hızlı aksiyonları, ceza/uyarı durumunu, bekleyen grup davetlerini, aktif randevuları ve kategorize edilmiş kütüphane duyurularını tek bir merkezde sunar.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`)
- **Yönlendirme (Routing):** `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN` tam dil desteği)
- **API İstemcisi:** `../api` (Cihaz kimliği ve WebGL donanım parmak izi başlıklarını otomatik ekleyen Axios istemcisi)
- **Yardımcı Fonksiyonlar:** `../utils/formatTime` (`formatRelativeTime` ile duyuru zamanlarının göreceli gösterimi)
- **Alt Bileşenler:** `Navbar.jsx`, `Footer.jsx`

##  3. İş Mantığı, Güvenlik ve State Yönetimi (Business Logic & State)

Bileşen yüklendiğinde iki aşamalı güvenlik ve veri çekme yaşam döngüsü (`useEffect`) çalışır:

### A. Güvenlik, Sözleşme ve Rol Koruması (Auth & Role Guard)
1. **Oturum Kontrolü:** `status === "unauthenticated"` ise kullanıcı anında `/` (Login) sayfasına yönlendirilir.
2. **Sözleşme Zorunluluğu:** `session.user.acceptedAgreementVersion` değeri yoksa kullanıcı Dashboard'u göremez ve zorunlu olarak `/rules` sayfasına yönlendirilir.
3. **Yetkili Yönlendirmesi (Role Guard):**
   - `ADMIN` (Kütüphane Müdürü) ve `SUPER_ADMIN` (BİM) rolleri öğrenci ekranına giremez; doğrudan `/admin` yönetim merkezine yönlendirilir.
   - `LIBRARIAN` (Kütüphane Görevlisi) varsayılan olarak `/admin` sayfasına yönlendirilir; ancak URL'de `?studentView=true` parametresi varsa öğrenci görünümüne geçiş yapabilir.

### B. Eşzamanlı Veri Çekme (`Promise.all`)
Sayfa açılışında 3 API uç noktası paralel olarak çağrılır:
- `GET /api/announcements`: Aktif kütüphane duyurularını çeker.
- `GET /api/invitations`: Öğrenciye gelen ve 30 dakikalık onay süresi dolmamış `PENDING` grup davetlerini çeker.
- `GET /api/reservations/active`: Öğrencinin organizatör veya onaylı katılımcı olduğu aktif (`PENDING`, `CONFIRMED`, `CHECKED_IN`) randevuları çeker.

### C. Ban (Yasaklı) ve No-Show Ceza Kontrolü (`isBanned` & `noShowCount`)
- Oturumdan gelen `session.user.isBanned`, `session.user.banUntil` ve `session.user.noShowCount` değerleri okunur.
- Kullanıcı banlıysa (`isBanned === true`):
  - Sayfanın en üstünde kırmızı bir `<Alert severity="error">` bandı ile ban bitiş tarihi (`banUntil` veya *Kalıcı/Süresiz*) ve ban sebebi (`banReason`) gösterilir.
  - **"Oda Rezerve Et"** kartı grileşir (`cursor: 'not-allowed'`), butonu `disabled` olur ve üzerinde *"Hesap Askıda / Suspended"* yazar.
  - Gelen grup davetlerindeki **"Kabul Et"** butonu `disabled` durumuna geçer (banlı öğrenci yeni bir gruba katılamaz, yalnızca daveti reddedebilir).

##  4. Arayüz Düzeni ve Bileşen Mimarisi (Layout Architecture)

Sayfa masaüstünde iki sütunlu esnek (`flex`) bir düzene sahiptir; mobilde (`xs`) tüm bloklar alt alta dizilir:

1. **Üst Bilgi ve Disiplin Rozeti:**
   - Sol tarafta kullanıcıyı adıyla karşılayan başlık, sağ tarafta ise **"No-Show Uyarısı: X / 3"** (veya yasaklı durumu) rozeti ile **"Kütüphane 7/24 Açık (00:00 - 24:00)"** bilgi kutusu yer alır.
2. **Sol Sütun (Ana İşlemler - `flex: 1`):**
   - **Hızlı İşlemler (Quick Actions):** *Oda Rezerve Et* (`/reserve`), *Rezervasyonlarım* (`/bookings`) ve *Rezervasyon Kuralları* (`/rules?view=true`) kartları.
   - **Bekleyen Davetlerim (Pending Invitations):** Varsa 30 dakika onay süreli grup davetlerini listeler; `POST /api/invitations/respond` ile *Kabul Et* veya *Reddet* aksiyonu alır ve listeyi anında günceller.
   - **Aktif Rezervasyonlarım:** Tarih rozeti, saat aralığı (`24:00` gece yarısı desteğiyle), onaylı katılımcı sayısı ve durum çipi (`Onay Bekliyor`, `Onaylandı`, `Şu An Aktif`) ile listelenir.
3. **Sağ Sütun (Sabitlenmiş Duyuru Paneli - `width: 350px`, `sticky`):**
   - Duyurular **Tümü (`ALL`)**, **Acil & Önemli (`IMPORTANT`)** ve **Bilgi / Normal (`NORMAL`)** çipleriyle filtrelenebilir.
   - Sayfa uzamasını önlemek için duyurular `ANN_PER_PAGE = 3` sabitiyle **3'erli sayfalama (`<Pagination />`)** yapısıyla gösterilir.
   - *(Mimari Karar: Oda yoğunluk grafiği `RoomDensityChart` öğrenci ekranında kalabalık yaratmaması için buradan kaldırılmış ve yalnızca Yönetim Paneline `/admin` taşınmıştır).*

##  5. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `frontend/src/components/Navbar.jsx` & `Footer.jsx`
- `backend/src/app/api/announcements/route.js` (`GET`)
- `backend/src/app/api/invitations/route.js` (`GET`)
- `backend/src/app/api/invitations/respond/route.js` (`POST`)
- `backend/src/app/api/reservations/active/route.js` (`GET`)