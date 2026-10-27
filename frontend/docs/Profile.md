# Context: Profile.jsx

##  1. Dosyanın Amacı ve Mimari Rolü

`Profile.jsx`, hem öğrencilerin hem de kütüphane/sistem yetkililerinin kurumsal hesap bilgilerini görüntülediği ve acil durum iletişim numaralarını (`phone`) güncellediği profil sayfasıdır.

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`) 
- **Kimlik Doğrulama:** `next-auth/react` (`useSession`) 
- **Yönlendirme:** `react-router-dom` (`useNavigate`) 
- **Çoklu Dil (i18n):** `react-i18next` (`TR` ve `EN`) 
- **API İstemcisi:** `../api` (`GET /api/profile` ve `PATCH /api/profile`) 

##  3. İş Mantığı, Microsoft Fotoğraf Senkronizasyonu ve Rol Duyarlılığı

### A. Microsoft Azure AD Profil Resmi ve Baş Harf Fallback Yapısı
- Kullanıcı Microsoft kurumsal hesabıyla giriş yaptığında Azure AD'den çekilen fotoğraf (`profile.avatarUrl`) doğrudan `<Avatar src={profile.avatarUrl}>` bileşeninde gösterilir.
- Kullanıcının Microsoft hesabında fotoğraf yoksa, ad ve soyadının baş harfleri (`initials`) hesaplanarak kurumsal mavi zemin üzerinde gösterilir . *(Güvenlik ve moderasyon standartları gereği dışarıdan manuel fotoğraf yükleme kapalıdır; fotoğraf Microsoft hesabından senkronize edilir)*.

### B. Öğrenci ve Yetkili Görünüm Ayrımı (`isAdminOrSuper` & `isStaff`)
- **Bilgi Satırları (`infoRows`):** Kullanıcı öğrenciyse **Öğrenci No (`studentNumber`)** ve **Bölüm (`department`)** gösterilir; kullanıcı yetkiliyse (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) öğrenci numarası yerine **Kurumsal Yetki (`ROLE_LABELS_TR` / `ROLE_LABELS_EN`)** ve **Birim / Daire Başkanlığı** gösterilir.
- **Telefon Uyarısı Koruması:** Telefon numarası eksik olduğunda gösterilen sarı uyarı kutusu (`<Alert severity="warning">`), yalnızca öğrencilere (`phoneIsMissing && !isAdminOrSuper`) gösterilir; Kütüphane Müdürü ve BİM yöneticilerinde gereksiz uyarı kalabalığı yapmaz.
- **Gizlilik ve İletişim Açıklaması:** Girilen telefon numarasının SMS reklamları için değil, yalnızca oda kullanımı sırasında acil durumlarda veya unutulan eşyalarda kütüphane görevlilerinin öğrenciye ulaşabilmesi için kullanıldığı açıkça belirtilir ve yönetim panelindeki (`AdminPanel.jsx`) öğrenci/rezervasyon kartlarına yansır.

##  4. Bağlantılı Olduğu Dosyalar ve API Uç Noktaları

- `backend/src/app/api/profile/route.js` (`GET` & `PATCH`) 
- `backend/src/app/api/admin/manage/route.js` (Telefon bilgisinin görevli/müdür ekranında gösterimi) 