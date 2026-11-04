# Context: theme.js

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/theme.js`, istemci uygulamasının kurumsal görsel kimliğini, renk paletini, tipografi ölçeğini ve Material-UI (MUI v7) bileşenlerinin varsayılan stil uyarlamalarını (`styleOverrides`) tanımlayan merkezi tasarım sistemi (Design System) modülüdür.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** `@mui/material/styles` (`createTheme`)
- **Yerelleştirme:** `@mui/material/locale` (`trTR`, `enUS`)

## 3. İş Mantığı ve Bileşen Mimarisi

1. **Kurumsal Renk Paleti (`palette`):**
   - **Birincil (`primary`):** Kurumsal mavi (`#137FEC`, açık `#DBEAFE`, koyu `#1D4ED8`).
   - **İkincil (`secondary`):** Kurumsal gri/lacivert (`#617589`).
   - **Zemin ve Metin:** Göz yormayan açık gri sayfa zemini (`#F6F7F8`), beyaz kart zemini (`#FFFFFF`) ve yüksek kontrastlı metin tonları (`#111418`, `#617589`).
   - **Durum Renkleri:** Onay/Müsait için yeşil (`#16A34A`), Hata/İptal/Ban için kırmızı (`#EF4444`), Beklemede/Uyarı için turuncu (`#F97316`).
2. **Tipografi ve Bileşen Özelleştirmeleri (`typography` & `components`):**
   - Yazı tipi ailesi `"Inter", "Roboto", "Helvetica", "Arial", sans-serif` olarak yapılandırılmış ve butonlarda büyük harf zorunluluğu kaldırılmıştır (`textTransform: 'none'`).
   - `MuiButton` (`8px` köşe, gölgesiz düz tasarım), `MuiCard` (`12px` köşe, yumuşak gölge ve `#F0F2F4` kenarlık), `MuiChip` (`6px` modern rozet) ve `MuiAppBar` için tutarlı kurumsal görünüm tanımlanmıştır.
3. **Dil Duyarlı Tema Üreticisi (`getAppTheme`):** Seçilen dile göre `trTR` veya `enUS` yerelleştirme paketini `createTheme` ile birleştirir ve varsayılan Türkçe temayı dışa aktarır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/main.jsx` (`<ThemeProvider theme={theme}>`)
- Tüm `frontend/src/pages/*.jsx` ve `frontend/src/components/*.jsx` bileşenleri
