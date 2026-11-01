# Context: frontend/src/components/admin/*

## 1. Bileşenlerin Amacı ve Mimari Rolü

Yönetici panelinin her bir fonksiyonel alanını bağımsız birer alt bileşene ayırarak kod tekrarını önlemek, test edilebilirliği ve bakım kolaylığını maksimize etmek.

## 2. Sekmelerin Görev Dağılımı ve İş Mantığı

### A. `AnalyticsTab.jsx` (İstatistikler ve Grafikler)
- Kütüphanenin günlük doluluk oranını, toplam tamamlanan randevu sayısını, aktif dolu oda sayısını ve en çok tercih edilen odaların kullanım grafiğini render eder.

### B. `ReservationsTab.jsx` (Randevu Takibi ve İptal)
- Kütüphanedeki tüm rezervasyonları durum rozetleriyle (`PENDING`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `NO_SHOW`, `CANCELLED`) listeler.
- Yöneticiye gerekçe belirterek herhangi bir randevuyu anında iptal etme (`CANCEL_RESERVATION`) imkanı tanır.

### C. `RoomsTab.jsx` (Oda Yönetimi)
- Odaların kapasite, kat, grup büyüklükleri ve aktiflik durumlarını listeler.
- Yeni oda ekleme (`CREATE_ROOM`), kapasite güncelleme (`UPDATE_ROOM`) ve odayı pasife alma/silme (`DELETE_ROOM`) operasyonlarını yönetir.

### D. `AnnouncementsTab.jsx` (Duyuru Yayınlama)
- Öğrencilere gösterilecek sistem duyurularını ekler (`CREATE_ANNOUNCEMENT`), düzenler ve son geçerlilik tarihi (`expiresAt`) belirler.

### E. `UsersTab.jsx` (Kullanıcılar ve Disiplin)
- Öğrenci listesini arama filtresiyle sunar; öğrencinin ceza puanını gösterir.
- **Gelişmiş Banlama (`BAN_USER`):** Kullanıcıyı 30 gün askıya alır; bugünkü ve gelecekteki randevularının anında iptal edilmesini sağlar.
- **Ban Kaldırma (`UNBAN_USER`):** Cezalı öğrencinin haklarını iade eder.

### F. `RulesAndLogsTab.jsx` (Kurallar ve Güvenlik Logları)
- Yürürlükteki `maxAdvanceDays`, `maxDailyHours`, `noShowToleranceMinutes` kurallarını günceller.
- Sistemde gerçekleşen tüm yönetici işlemlerini (`AuditLog`) zaman damgasıyla listeler.

### G. `adminConstants.js` (Ortak Sabitler)
- Sekme kimlikleri, renk kodları (Chip renk haritaları) ve ortak tablo başlıklarını içerir.

## 3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/AdminPanel.jsx`
- `backend/src/app/api/admin/manage/handlers.js`