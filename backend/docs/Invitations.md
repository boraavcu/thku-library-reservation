# Context: invitations/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/invitations/route.js`, öğrenciye gönderilen ve yanıt bekleyen (`PENDING`) grup çalışması davetlerini `Dashboard.jsx`, `MyBookings.jsx` ve `Navbar.jsx` bildirim merkezine ileten uç noktadır (`GET`).

##  2. İş Mantığı ve Geçerlilik Filtresi

1. Yanıt süresini geciktirmemek için `runReservationLifecycleChecks().catch(() => {})` fonksiyonunu arka planda asenkron olarak tetikler.
2. `prisma.reservationParticipant.findMany` ile kullanıcıya ait `status: "PENDING"` olan ve bağlı olduğu rezervasyonu iptal edilmemiş (`status: { in: ["PENDING", "CONFIRMED"] }`) davetleri çeker.
3. `Europe/Istanbul` saat dilimine göre randevunun bitiş saati henüz geçmemiş olanları filtreleyerek oda ve organizatör bilgileriyle birlikte döndürür.

##  3. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/Dashboard.jsx`, `MyBookings.jsx` ve `components/Navbar.jsx`
- `backend/src/app/api/invitations/respond/route.js`