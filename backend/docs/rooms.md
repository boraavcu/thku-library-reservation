# Context: rooms/route.js

##  1. Dosyanın Amacı ve Mimari Rolü

`backend/src/app/api/rooms/route.js`, kütüphanedeki aktif çalışma odalarının (`isActive: true`) listesini döndüren temel API uç noktasıdır (`GET`).

##  2. İş Mantığı

1. İlk olarak `checkRulesAcceptance(request)` ara katmanını çağırarak kullanıcının oturumunu ve güncel kullanıcı sözleşmesini onaylayıp onaylamadığını doğrular.
2. `prisma.room.findMany({ where: { isActive: true }, orderBy: { roomNumber: "asc" } })` sorgusuyla aktif çalışma odalarını (`R101 - Atatürk`, `R102 - Gökçen`, `R103 - Hürkuş`, `R104 - İstikbal`) oda numarasına göre sıralı olarak döndürür.

##  3. Bağlantılı Olduğu Dosyalar

- `backend/src/middleware/checkRulesAcceptance.js`
- `backend/src/app/api/reserve/init/route.js`