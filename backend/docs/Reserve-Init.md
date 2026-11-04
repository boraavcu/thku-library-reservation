# Context: reserve/init/route.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/reserve/init/route.js`, `StudyRooms.jsx` ve `ReserveForm.jsx` sayfaları açıldığında tek bir HTTP isteğiyle hem aktif çalışma odalarını hem de yöneticinin belirlediği **7 dinamik rezervasyon kuralını** (`rules`) istemciye ileten başlangıç (initialization) uç noktasıdır (`GET`).

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **Web Çatısı:** `next/server` (`NextResponse`)
- **Oturum & Şifre Kapısı:** `next-auth` (`getServerSession`, `authOptions`) & `@/lib/passwordGate` (`rejectIfPasswordChangeRequired`)
- **Veritabanı ORM:** `@/lib/db` (`PrismaClient` — `Room`)
- **Rezervasyon Politikası:** `@/lib/reservationPolicy` (`getActiveReservationRules`)

## 3. İş Mantığı ve Dinamik Kural Eşlemesi (`GET`)

1. **Şifre Kapısı ve Oturum Kontrolü:** `rejectIfPasswordChangeRequired(session)` ile geçici şifre oturumları (`403 PASSWORD_CHANGE_REQUIRED`) ve oturumsuz istekler (`401`) engellenir.
2. **Paralel Veri Çekimi (`Promise.all`):**
   - `prisma.room.findMany({ where: { isActive: true }, orderBy: { roomNumber: "asc" } })` ile kullanıma açık odalar çekilir.
   - `getActiveReservationRules()` ile veritabanındaki 7 aktif kural (`minParticipants`, `maxParticipants`, `maxDurationHours`, `maxAdvanceDays`, `dailyReleaseHour`, `checkinToleranceMinutes`, `cancelLockMinutes`) tek merkezden okunarak `{ rooms, rules }` olarak döndürülür.

## 4. Bağlantılı Olduğu Dosyalar

- `frontend/src/pages/StudyRooms.jsx` & `frontend/src/pages/ReserveForm.jsx`
- `backend/src/lib/passwordGate.js`
- `backend/src/lib/reservationPolicy.js`
- `backend/src/app/api/admin/manage/handlers.js` (`UPDATE_RULE` aksiyonu)
