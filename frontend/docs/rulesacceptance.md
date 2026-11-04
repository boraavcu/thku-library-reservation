# Context: RulesAcceptance.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/RulesAcceptance.jsx`, sisteme ilk kez giriş yapan veya yeni bir kullanıcı sözleşmesi versiyonu yayınlandığında henüz onay vermemiş kullanıcıların kütüphane kurallarını okuyup onayladığı zorunlu sözleşme ekranıdır. Aynı zamanda sözleşmeyi daha önce onaylamış kullanıcıların `/rules?view=true` üzerinden kuralları salt okunur olarak incelemesini sağlar.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`, `signOut`)
- **Yönlendirme & Alt Dizin Yolları:** `react-router-dom` (`useNavigate`, `useSearchParams`), `../runtimePaths` (`appAbsoluteUrl`, `appPath`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **API & Bileşenler:** `../api` (`GET /api/agreements/active`, `POST /api/user/accept-rules`), `../components/Footer`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. 6 Maddelik Sözleşme Ayrıştırıcısı (`parseRules` & `ENGLISH_RULES`)
- `GET /api/agreements/active` uç noktasından PostgreSQL veritabanındaki aktif sözleşme metni ve versiyonu çekilir.
- Türkçe dilinde veritabanından gelen metin `parseRules(agreement?.content)` ile numaralı maddelere ayrıştırılır; İngilizce dilinde ise `ENGLISH_RULES` sabiti üzerinden aynı 6 temel kural (*Maksimum Süre & Gece-Gündüz Kuralı*, *±15 Dk Kapı QR & 3/3 No-Show Cezası*, *Sessizlik*, *Ekipman Sorumluluğu*, *2–8 Kişi Grup Çalışması & 30 Dk Davet Süresi*, *İleri Tarih & Erken Boşaltma*) sunulur.

### B. Sözleşme Onayı, `/randevu` Alt Dizin Uyumu ve Kiosk Dönüşü
- Kullanıcı sözleşmeyi onayladığında (`handleContinue`), `POST /api/user/accept-rules` çağrılır ve `update({ acceptedAgreementVersion: res.data.acceptedVersion })` ile oturum güncellenir.
- **Kiosk Kapı QR Dönüşü ve `appPath` Yönlendirmesi:** Eğer öğrenci sisteme ilk kez kapıdaki QR kodu okutarak girdiyse, `sessionStorage` içindeki `thku_kiosk_return_door` değeri okunarak hedef adres `/kiosk?door=...` olarak belirlenir (aksi halde yetkililer için `/admin`, öğrenciler için `/dashboard`); ardından `window.location.href = appPath(nextPath)` ile `/randevu` alt dizinine tam uyumlu yönlendirme yapılır.
- Çıkış butonu (`handleLogout`), `signOut({ callbackUrl: appAbsoluteUrl('/') })` ile kullanıcıyı güvenli biçimde `/randevu/` giriş ekranına döndürür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/runtimePaths.js` (`appPath`, `appAbsoluteUrl`)
- `frontend/src/App.jsx` (`rulesRejected` dinleyicisi ve `/rules` rotası)
- `frontend/src/components/Footer.jsx`
- `backend/src/app/api/agreements/active/route.js` (`GET`)
- `backend/src/app/api/user/accept-rules/route.js` (`POST`)
