# Context: RulesAcceptance.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`RulesAcceptance.jsx`, sisteme ilk kez giriş yapan (veya yeni bir sözleşme versiyonu yayınlandığında henüz onaylamamış olan) kullanıcıların kütüphane kullanım kurallarını okuyup onayladığı zorunlu sözleşme ekranıdır . Ayrıca sözleşmeyi daha önce onaylamış kullanıcıların üst menüden veya alt bilgiden (`Footer`) `/rules?view=true` bağlantısıyla kuralları tekrar okuyabilmesini sağlar.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`, `signOut`) 
- **Yönlendirme:** `react-router-dom` (`useNavigate`, `useSearchParams`) 
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN`) 
- **API İstemcisi:** `../api` (`GET /api/agreements/active` ve `POST /api/user/accept-rules`) 

##  3. İş Mantığı, Çoklu Dil Ayrıştırıcısı ve Rol Yönlendirmesi

### A. 6 Maddelik Sözleşme Ayrıştırıcısı (`parseRules` & `ENGLISH_RULES`)
- Sayfa açıldığında `GET /api/agreements/active` uç noktasından veritabanındaki aktif sözleşme (`v1.0`) çekilir .
- Dil Türkçe (`tr`) ise veritabanından gelen metin `parseRules(agreement.content)` fonksiyonu ile numaralı maddelere (`1.` – `6.`) ayrıştırılarak şık numaralı kartlar halinde ekrana basılır.
- Dil İngilizce (`en`) ise `ENGLISH_RULES` sabiti devreye girerek aynı 6 kuralın (*Maksimum 3 Saat ve Gece-Gündüz Kuralı*, *±15 Dk Kapı QR ve 3/3 No-Show Ban Kuralı*, *Sessizlik Kuralları*, *Ekipman Sorumluluğu*, *2-8 Kişi Grup Çalışması ve 30 Dk Davet Süresi*, *1 Gün İleri Tarih ve Erken Boşaltma*) tam İngilizce karşılıklarını sunar.

### B. Onay Modu vs. Görüntüleme Modu (`alreadyAccepted || isViewMode`)
- Kullanıcı sözleşmeyi henüz onaylamamışsa alt sabit barda onay kutucuğu (`Checkbox`), *"Çıkış Yap"* butonu ve *"Anlıyorum ve Devam Et"* butonu gösterilir . Onaylandığında `POST /api/user/accept-rules` çağrılır ve NextAuth oturumu `update({ acceptedAgreementVersion })` ile anında güncellenir.
- Kullanıcı sözleşmeyi zaten onaylamışsa (`alreadyAccepted`) veya `?view=true` ile girdiyse, alt barda yeşil bir onay rozeti (`✓ Bu sözleşmeyi (v1.0) onayladınız`) ve geri dönüş butonu gösterilir .
- **Rol Bazlı Geri Dönüş (`homePath`):** `isStaff` (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) için geri dönüş adresi `/admin` (*Yönetim Merkezine Dön*), öğrenciler için `/dashboard` (*Ana Sayfa*) olarak dinamik belirlenir.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/agreements/active/route.js` (`GET`) 
- `backend/src/app/api/user/accept-rules/route.js` (`POST`) 
- `backend/src/middleware/checkRulesAcceptance.js` 