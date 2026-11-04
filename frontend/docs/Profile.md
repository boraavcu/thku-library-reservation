# Context: Profile.jsx

## 1. Dosyanın Amacı ve Mimari Rolü

`frontend/src/pages/Profile.jsx`, öğrencilerin ve kurumsal yetkililerin hesap bilgilerini görüntülediği ve acil durum iletişim telefon numaralarını (`phone`) güncellediği profil sayfasıdır.

## 2. Teknoloji Yığını ve Bağımlılıklar

- **UI Framework:** Material-UI (`@mui/material`, `@mui/icons-material`)
- **Kimlik Doğrulama & Yönlendirme:** `next-auth/react` (`useSession`), `react-router-dom` (`useNavigate`)
- **Çoklu Dil (i18n):** `react-i18next` (`useTranslation`)
- **API İstemcisi:** `../api` (`GET /api/profile` ve `PATCH /api/profile`)
- **Alt Bileşenler:** `../components/Navbar`, `../components/Footer`

## 3. İş Mantığı ve Bileşen Mimarisi

### A. Microsoft Profil Fotoğrafı ve Baş Harf Yedek (Fallback) Yapısı
- Kurumsal Microsoft Entra ID hesabından senkronize edilen `profile.avatarUrl` mevcutsa `<Avatar>` bileşeninde gösterilir; fotoğraf bulunmayan hesaplarda ad ve soyadın baş harfleri (`initials`) kurumsal mavi zemin üzerinde oluşturulur.

### B. Öğrenci ve Kurumsal Yetkili Görünüm Ayrımı (`isStaff` & `isAdminOrSuper`)
- **Dinamik Bilgi Satırları (`infoRows`):** Öğrencilerde *Öğrenci No (`studentNumber`)* ve *Bölüm (`department`)* satırları yer alırken, yetkililerde (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`) *Kurumsal Yetki (`ROLE_LABELS_TR` / `ROLE_LABELS_EN`)* ve *Birim / Daire Başkanlığı* bilgileri gösterilir.
- **Telefon Uyarısı ve Kayıt (`PATCH /api/profile`):** Telefon numarası eksik olduğunda gösterilen hatırlatma uyarısı (`phoneIsMissing && !isAdminOrSuper`) yalnızca öğrencilere ve görevlilere gösterilir; müdür ve BİM yöneticilerinde gereksiz uyarı kalabalığı oluşturmaz. Kaydedilen numara yönetim panelindeki (`AdminPanel.jsx`) öğrenci ve rezervasyon kartlarına anında yansır.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/components/Navbar.jsx` & `Footer.jsx`
- `frontend/src/pages/AdminPanel.jsx` (`UsersTab` ve `ReservationsTab` telefon bilgisi gösterimi)
- `backend/src/app/api/profile/route.js` (`GET` & `PATCH`)
