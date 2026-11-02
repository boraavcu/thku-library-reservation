# Context: reserve/init/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/reserve/init/route.js`, `StudyRooms.jsx` ve `ReserveForm.jsx` sayfaları açıldığında tek bir HTTP isteğiyle hem aktif çalışma odalarını hem de yöneticinin belirlediği **7 dinamik rezervasyon kuralını** (`rules`) istemciye ileten başlangıç (initialization) uç noktasıdır (`GET`).

##  2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum Doğrulama:** `next-auth` (`getServerSession`, `authOptions`)
- **Veritabanı ORM:** `@/lib/db` (Prisma Client)
- **Rezervasyon Politikası:** `@/lib/reservationPolicy` (`getActiveReservationRules`)

##  3. İş Mantığı ve Dinamik Kural Eşlemesi (`Promise.all`)

1. **Paralel Veri Çekimi:**
   - `prisma.room.findMany({ where: { isActive: true }, orderBy: { roomNumber: "asc" } })` ile kullanıma açık odalar çekilir.
   - `getActiveReservationRules()` ile veritabanındaki 7 aktif kural tek merkezden okunur.
2. **Döndürülen 7 Dinamik Kural (`rules`):**
   - `maxDurationHours`: Maksimum rezervasyon süresi (Varsayılan: `3` saat)
   - `maxAdvanceDays`: Kaç gün sonrasına randevu alınabileceği (Varsayılan: `1` gün)
   - `minParticipants`: Minimum grup üyesi sayısı (Varsayılan: `2` kişi)
   - `maxParticipants`: Maksimum grup üyesi sayısı (Varsayılan: `8` kişi)
   - `dailyReleaseHour`: Yeni gün kotasının açılış saati (Varsayılan: `8` -> `08:00`)
   - `checkinToleranceMinutes`: Kapı QR yoklama tolerans süresi (Varsayılan: `15` dk -> `±15 dk`)
   - `cancelLockMinutes`: Başlangıca kaç dakika kala iptalin kilitleneceği (Varsayılan: `60` dk)

##  4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx`
- `frontend/src/pages/ReserveForm.jsx`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/app/api/admin/manage/handlers.js` (`UPDATE_RULE` aksiyonu)
