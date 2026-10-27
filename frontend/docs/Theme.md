# Context: theme.js

##  1. Dosyanın Amacı ve Mimari Rolü

`theme.js`, uygulamanın görsel kimliğini, kurumsal renk paletini, tipografi hiyerarşisini ve Material-UI (MUI) bileşenlerinin varsayılan stil ezilmelerini (`styleOverrides`) tanımlayan merkezi tasarım sistemi (Design System) dosyasıdır.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** `@mui/material/styles` (`createTheme`)
- **Yerelleştirme:** `@mui/material/locale` (`trTR`, `enUS` tablo ve sayfalama yerelleştirmeleri)

##  3. Renk Paleti, Tipografi ve Bileşen Özelleştirmeleri

1. **Renk Paleti (`palette`):**
   - **Primary (Kurumsal Mavi):** `main: '#137FEC'`, `light: '#DBEAFE'`, `dark: '#1D4ED8'`
   - **Secondary (Kurumsal Gri/Lacivert):** `main: '#617589'`, `light: '#F1F5F9'`, `dark: '#4B5563'`
   - **Background:** Sayfa zemini için göz yormayan açık gri (`default: '#F6F7F8'`), kartlar için tam beyaz (`paper: '#FFFFFF'`).
   - **Durum Renkleri:** Onay/Müsait için Yeşil (`#16A34A`), İptal/Ban/Hata için Kırmızı (`#EF4444`), Bekleyen/Uyarı için Turuncu (`#F97316`).
2. **Tipografi (`typography`):**
   - Ana yazı tipi ailesi `"Inter", "Roboto", "Helvetica", "Arial", sans-serif` olarak ayarlanmıştır.
   - Butonlarda tüm harfleri büyük yapma zorunluluğu kaldırılmış (`textTransform: 'none'`), modern okunabilirlik sağlanmıştır.
3. **Bileşen Stilleri (`components`):**
   - `MuiButton`: `8px` yuvarlatılmış köşeler ve gölgesiz (`boxShadow: 'none'`) düz (flat) tasarım.
   - `MuiCard`: `12px` yuvarlatılmış köşeler, hafif derinlik gölgesi ve `#F0F2F4` ince kenarlık.
   - `MuiChip`: `6px` hafif köşeli modern rozet görünümü.

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/main.jsx` ve tüm MUI bileşenleri