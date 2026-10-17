# Context: RulesAcceptance.jsx

## 📌 1. Dosyanın Amacı ve Rolü
`RulesAcceptance.jsx`, "THK University Kütüphane Rezervasyon Sistemi"nde bir **Ara Katman (Interstitial/Middleware)** sayfası olarak görev yapar. Kullanıcı sisteme başarılı bir şekilde giriş yaptıktan sonra, kütüphane kullanım kurallarını henüz onaylamamışsa zorunlu olarak bu sayfaya yönlendirilir. Kullanıcı bu sayfadaki kuralları okuyup onaylamadan sistemin (Dashboard vb.) hiçbir özelliğine erişemez. Hukuki ve sistemsel bir bariyerdir.

## 🛠 2. Teknoloji Yığını (Tech Stack)
- **UI Framework:** Material-UI (MUI v5)
- **Authentication:** `next-auth/react` (`useSession`, `update`)
- **Routing:** `react-router-dom` (`Maps`, `useNavigate`)
- **API Mimarisi:** Custom Axios Instance (`import api from '../api'`)
- **Etkileşim:** MUI `Checkbox`, `Button`, `Dialog` veya `Card` bileşenleri.

## 🧠 3. İş Mantığı ve State Yönetimi (Business Logic & State)
Bu bileşenin en kritik noktası "State" ve "Session" yönetimidir. Kullanıcının sistemi atlatmasını (bypass) engellemelidir.

### A. Yönlendirme ve Güvenlik Duvarı (Auth Guard)
- Bileşen yüklendiğinde `useSession()` ile oturum kontrol edilir.
- **Oturum Yoksa:** `status === "unauthenticated"` ise anında `/` (Login) sayfasına atılır.
- **Kurallar Zaten Onaylanmışsa:** `session.user.hasAcceptedRules === true` ise, kullanıcının bu sayfada işi yoktur. Yanlışlıkla geldiyse anında `<Navigate to="/dashboard" replace />` ile yönlendirilir.

### B. Onay Akışı (Acceptance Flow)
- Kullanıcıdan alınan "Okudum, anladım" eylemi bir `useState(false)` (Örn: `isChecked`) ile tutulur.
- Checkbox işaretlenmeden "Kabul Et" butonu kesinlikle **`disabled`** (devre dışı) kalmalıdır.

### C. API İsteği ve Oturum Güncelleme (Mutation & Session Refresh)
- Butona tıklandığında `api.post('/users/accept-rules')` (veya ilgili endpoint) çağrılır.
- İstek esnasında buton `loading` durumuna geçer ve spam tıklamalar engellenir.
- **Kritik Adım:** Veritabanı güncellendikten sonra, frontend'deki oturum verisinin de güncellenmesi gerekir. Bunun için NextAuth'un `update()` fonksiyonu çağrılır (Örn: `await update({ hasAcceptedRules: true })`).
- Oturum güncellendikten sonra kullanıcı `/dashboard` rotasına yönlendirilir.

## 📐 4. Layout ve Grid Sistemi (Kritik Kurallar)
Bu sayfa, kullanıcının metne odaklanmasını sağlamak için tasarlanmıştır.

- **Ana Taşıyıcı:** Sayfa ortalanmış, tek bir ana sütundan oluşur. `Container maxWidth="md"` (veya `sm`) kullanılarak okunabilirlik artırılır.
- **İçerik Alanı (Scrollable Area):** Kurallar metni uzun olabileceği için `Paper` veya `Card` bileşeninin içeriği sınırlandırılmalı ve kendi içinde kaydırılabilir olmalıdır (`maxHeight: '60vh'`, `overflowY: 'auto'`, `pr: 1` scrollbar payı).
- **Aksiyon Alanı:** Checkbox ve Onay butonu, kaydırılabilir metnin **altında sabit (sticky) veya ayrı bir kutuda** yer almalıdır. Kullanıcı aşağı inmeden de onay kutusunu görebilmelidir (veya UX gereği en alta inmeye zorlanabilir).

## 🎨 5. Tasarım ve Tema Kuralları (MUI Constraints)
Mevcut `theme.js` mimarisine tam uyum sağlanmalıdır.

- **Renkler:** Arka plan `background.default`, kart/kağıt arka planı `background.paper` olmalıdır.
- **Tipografi:** Başlık için vurgulu bir font (`h5` veya `h4`, `color: 'text.primary'`), kurallar metni için okunaklı bir gövde metni (`body1` veya `body2`, `color: 'text.secondary'`, `lineHeight: 1.6`) kullanılmalıdır.
- **Butonlar:** - İptal / Çıkış butonu varsa `color: "error"` veya `color: "inherit"`.
  - Onay butonu kesinlikle `variant="contained"`, `color="primary"` ve vurgulu (`fontWeight: 700`, `size="large"`) olmalıdır.
- **Gölge (Elevation):** Kuralları içeren kutu, sayfa arka planından hafifçe ayrışması için gölgelendirilebilir (`elevation={1}` veya `border` ile).

## 🚀 6. Hata Yönetimi ve Gelecek Geliştirmeler (Error Handling & Future)
- **Hata Gösterimi:** Eğer `api.post` işlemi başarısız olursa (ağ hatası vb.), butonun hemen üzerinde veya Snackbar ile kullanıcıya MUI `<Alert severity="error">` gösterilmelidir.
- **Dinamik Kurallar:** Şu an metin frontend içinde hardcoded (sabit) yazılmış olabilir. İlerleyen aşamalarda bu sayfa yüklendiğinde `api.get('/settings/rules')` gibi bir endpoint'ten güncel kural metnini (HTML veya Markdown olarak) çekip ekrana basacak şekilde güncellenecektir.