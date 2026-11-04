# Context: db.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/db.js`, PostgreSQL veritabanı ile uygulama arasındaki iletişimi sağlayan **Prisma Client Singleton** sağlayıcısıdır. Next.js'in geliştirme ortamındaki sıcak modül yeniden yükleme (Hot Module Replacement - HMR) süreçlerinde her sayfa isteğinde yeni bir bağlantı havuzu açılmasını (`too many connections`) engellerken, şema güncellemelerini veya `DATABASE_URL` değişimlerini algılayarak istemciyi güvenli biçimde yeniler.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **ORM:** `@prisma/client` (`PrismaClient`)
- **Veritabanı:** PostgreSQL (`DATABASE_URL`)

## 3. Çekirdek Yapılandırma ve İş Mantığı (Core Business Logic)

```javascript
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
};

const globalForPrisma = globalThis;

const existingClient = globalForPrisma.prismaGlobal;
const currentDbUrl = process.env.DATABASE_URL || '';
const prisma =
  existingClient &&
  typeof existingClient.kioskAttendance !== 'undefined' &&
  globalForPrisma.prismaDatabaseUrl === currentDbUrl
    ? existingClient
    : prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaGlobal = prisma;
  globalForPrisma.prismaDatabaseUrl = currentDbUrl;
}
```

- **Tekil Örnek (`globalForPrisma.prismaGlobal`):** Geliştirme ortamında tek bir `PrismaClient` örneği yeniden kullanılır.
- **Şema Güncelliği Kontrolü (`existingClient.kioskAttendance`):** `npx prisma generate` sonrasında yeni modeller (`kioskAttendance` vb.) eklendiğinde eski HMR önbelleğindeki eksik istemci yerine otomatik olarak taze bir `PrismaClient` oluşturur.
- **Bağlantı Adresi Değişim Algılaması (`prismaDatabaseUrl`):** `process.env.DATABASE_URL` değiştiğinde eski bağlantıyı terk ederek yeni veritabanı adresine bağlanır.

## 4. Bağlantılı Olduğu Dosyalar

- Tüm `backend/src/lib/*` servisleri
- Tüm `backend/src/app/api/*` rotaları
