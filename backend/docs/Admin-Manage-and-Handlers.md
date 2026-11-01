## 4. `backend/docs/Admin-Manage-and-Handlers.md`

```markdown
# Context: admin/manage/route.js & handlers.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/admin/manage/route.js` ve `handlers.js`, Yönetim Panelinin (`AdminPanel.jsx`) tüm analitik veri sorgulama (`GET`) ve idari operasyon (`POST`) uç noktasıdır.

**SOLID & Açık/Kapalı Prensibi (OCP):** `route.js` yalnızca yetki kontrolünü (`LIBRARIAN`, `ADMIN`, `SUPER_ADMIN`), 180/365 günlük log arşiv politikasını ve analitik hesaplamaları (`GET`) yürütür; `POST` isteklerini ise `handlers.js` içindeki `ADMIN_ACTION_HANDLERS` komut haritasına devreder.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Oturum ve Yetkilendirme:** `next-auth` (`getServerSession`, `authOptions`)
- **Veritabanı & Önbellek:** `@/lib/db` (Prisma Client) & `@/lib/redis` (`kiosk:checked_users:${id}`)
- **Yardımcı Servisler:** `@/lib/lifecycle`, `@/lib/timeUtils`, `@/lib/emailService`, `@/lib/penaltyService`

## 3. Çekirdek Fonksiyonlar ve İş Mantığı (Core Business Logic)

### A. `GET /api/admin/manage` — Analitik, Yoğunluk ve 180/365 Gün Log Motoru
1. **365 Gün Otomatik Arşiv Temizliği:** 1 yılı (365 gün) aşan `AuditLog` ve `AdminAction` kayıtlarını veritabanından otomatik temizler; son 180 günün kayıtlarını aktif listeler, 180–365 gün arasındaki kayıt sayısını `archivedRecordsCount` olarak raporlar.
2. **Gerçek Zamanlı Analitik Üretimi (`analytics`):**
   - `hourlyHeatmap`: 00:00 – 24:00 arası 24 saatlik yoğunluk dağılımı ve zirve saat (`peakHour`).
   - `departmentBreakdown` & `roomBreakdown`: Bölüm bazlı katılım yüzdeleri ve 4 çalışma odasının tercih sıralaması.
   - `activeNowRooms`, `upcomingHourReservations`, `upcomingHourStudents`: Gelecek 1 saatlik canlı operasyon radarı.
   - `completionRate`, `cancellationRate`, `noShowRate`, `avgDurationHours`, `avgGroupSize`.

### B. `POST /api/admin/manage` — `ADMIN_ACTION_HANDLERS` Komutları (`handlers.js`)
| Aksiyon (`action`) | Yetki | Açıklama |
| :--- | :--- | :--- |
| `TOGGLE_ROOM` | Tüm Yetkililer | Odayı yeni randevulara açar/kapatır (mevcut onaylı randevular korunur). |
| `CREATE_ROOM` | `ADMIN`, `SUPER_ADMIN` | Yeni çalışma odası ekler ve `AdminAction` logu düşer. |
| `UPDATE_ROOM` | `ADMIN`, `SUPER_ADMIN` | Oda kodunu, adını ve kapasitesini günceller. |
| `DELETE_ROOM` | `ADMIN`, `SUPER_ADMIN` | Odayı ve ilişkili kayıtları transaction içinde kalıcı siler. |
| `RESERVATION_OP` | Tüm Yetkililer | `FORCE_CHECKIN` (manuel giriş), `EARLY_FINISH` (erken boşaltma), `CANCEL` (iptal) ve `MARK_NO_SHOW` (gelmeyenlere ceza işleme). |
| `CREATE_ANNOUNCEMENT`| Tüm Yetkililer | TR/EN çok dilli ve öncelikli (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) duyuru yayınlar. |
| `DELETE_ANNOUNCEMENT`| Tüm Yetkililer | Duyuruyu siler. |
| `USER_MODERATION` | `ADMIN`, `SUPER_ADMIN` | `BAN_USER` (takvimli veya kalıcı Perma ban + bugünkü/gelecekteki randevu iptali), `UNBAN`, `RESET_PENALTY` ve sıkı hiyerarşili `CHANGE_ROLE`. |
| `UPDATE_RULE` | `ADMIN`, `SUPER_ADMIN` | 7 dinamik rezervasyon kuralını (`ReservationRule`) anında günceller. |

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/AdminPanel.jsx`
- `frontend/src/components/admin/*`
- `backend/src/lib/penaltyService.js`
- `backend/src/lib/emailService.js`
```