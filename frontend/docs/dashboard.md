# Context: Dashboard.jsx

## 📌 1. Dosyanın Amacı ve Rolü

`Dashboard.jsx`, "THK University Kütüphane Rezervasyon Sistemi"nin **ana kontrol panelidir**. Kullanıcı başarılı bir şekilde giriş yaptıktan ve kuralları onayladıktan sonra gördüğü ilk ve en kapsamlı ekrandır. Uygulamanın kalbidir; navigasyonu, hızlı işlemleri, aktif/yaklaşan rezervasyonları ve sistem duyurularını tek bir ekranda sunar.

## 🛠 2. Teknoloji Yığını (Tech Stack)

- **UI Framework:** Material-UI (MUI v5)
- **Authentication:** `next-auth/react` (`useSession`)
- **Routing:** `react-router-dom` (`useNavigate`)
- **API Mimarisi:** Custom Axios Instance (`import api from '../api'`)
- **İkonlar:** `@mui/icons-material`

## 🧠 3. İş Mantığı ve State Yönetimi (Business Logic & State)

Bileşen yüklendiğinde kusursuz bir sırayla çalışan iki temel mantık (useEffect) vardır:

### A. Güvenlik ve Yönlendirme (Auth Guard)

- `useSession()` kancası kullanılarak oturum durumu (`status`) dinlenir.
- **Yükleniyor:** `status === "loading"` ise tam ekran `<CircularProgress />` döner.
- **Oturum Yok:** `status === "unauthenticated"` ise anında Login (`/`) sayfasına postalanır.
- **Kurallar Onaylanmamış:** Oturum var ama `session.user.hasAcceptedRules` değeri `false` ise, kullanıcı Dashboard'u göremez, zorunlu olarak `/rules` (Kural Kabul) sayfasına yönlendirilir.

### B. Veri Çekme (Data Fetching)

- Sadece oturum varsa ve kurallar onaylanmışsa `api.get('/rooms')` tetiklenir.
- Hata durumunda ekranda `<Alert severity="error">` gösterilir.
- **ESLint Kuralı:** İleride kullanılmak üzere hazırlanan veri `const [, setRooms] = useState([]);` şeklinde tanımlanmıştır. Tasarım şu an statik (hardcoded) olduğu için `rooms` değişkeni kullanılıp "unused var" hatası alınmaması adına virgülle bypass edilmiştir.

## 📐 4. Layout ve Grid Sistemi (Kritik Kurallar)

Kusursuz bir "Landscape Tablet" ve Masaüstü görünümü için sayfa MUI `<Grid container spacing={3}>` ile iki ana kolona ayrılmıştır. **Bu yapı asla bozulmamalıdır:**

1. **Sol Kolon (Ana İşlemler - `md={8}`):**
   - Sayfanın %66'sını kaplar.
   - **Bileşenler:** Quick Actions (3'lü yan yana kartlar), Active Reservation (Check-in ve Geri Sayım arayüzü), Upcoming Reservations (Yaklaşan randevular listesi).
2. **Sağ Kolon (Sidebar/Bilgi - `md={4}`):**
   - Sayfanın %33'ünü kaplar.
   - **Bileşenler:** Announcements (Duyurular), Weekly Summary (İstatistikler), Footer Linkleri.

_Not: `xs={12}` kullanılarak mobilde tüm kolonların alt alta kusursuz dizilmesi sağlanmıştır._

## 🎨 5. Tasarım ve Tema Kuralları (MUI Constraints)

Kodun içinde kesinlikle hardcoded (örn: `#137fec`, `#ffffff`) renk kodları **KULLANILAMAZ.** Tüm renkler projeye ait `theme.js` üzerinden çekilmelidir.

- **Renk Kullanımı:** - Arka planlar için: `bgcolor: 'background.default'` veya `bgcolor: 'background.paper'`
  - Metinler için: `color: 'text.primary'`, `color: 'text.secondary'`, `color: 'text.disabled'`
  - Aksan renkleri: `primary.main`, `success.main`, `warning.main`
- **Gölge ve Kenarlıklar (Flat Design):** - Tasarım "Flat" (Düz) mimaridedir. Kartlarda varsayılan gölge kullanılmaz (`elevation={0}`).
  - Ayrım için hafif kenarlıklar kullanılır: `border: '1px solid'`, `borderColor: 'divider'`.
- **Şeffaflık (Opacity/Alpha):**
  - Buton veya rozet arka planlarında şeffaf renkler için MUI'nin `alpha` fonksiyonu kullanılır. _(Örn: `bgcolor: alpha(theme.palette.success.main, 0.1)`)_
- **Hafif Etkileşimler (Hover States):**
  - Tıklanabilir öğelerde (kartlar, butonlar) `.hover` stateleri `action.hover` kullanılarak yumuşak geçişler (`transition: 'all 0.2s'`) ile sağlanmıştır.

## 🚀 6. Gelecekte Yapılacaklar (Future Implementations)

- **Dinamik Veri Entegrasyonu:** Şu an arayüzde görünen "Room 302", "12 Hours Studied" gibi veriler statiktir. İlerleyen aşamalarda `setRooms` ile alınan veriler ve `/reservations` endpoint'i üzerinden alınacak veriler `map()` fonksiyonu ile bu tasarıma giydirilecektir. Giydirme yapılırken mevcut MUI elementlerinin (Card, Chip, Box) yapısı korunmalıdır.
- **Geri Sayım Sayacı (Timer):** "Active Reservation" içindeki "45 MINUTES LEFT" kısmı için gerçek zamanlı bir `setInterval` mantığı kurulacaktır.
