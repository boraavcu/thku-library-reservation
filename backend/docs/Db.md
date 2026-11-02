# Context: db.js

## 1. Dosyanın Amacı ve Mimari Rolü

`backend/src/lib/db.js`, PostgreSQL veritabanı ile uygulama arasındaki iletişimi sağlayan **Prisma Client Singleton** sağlayıcısıdır. Next.js'in geliştirme ortamındaki sıcak modül yeniden yükleme (Hot Module Replacement - HMR) süreçlerinde her sayfa isteğinde yeni bir bağlantı havuzu açılmasını ve veritabanı bağlantı sınırının (`too many connections`) tükenmesini engeller.

## 2. Teknoloji Yığını ve Bağımlılıklar (Tech Stack & Dependencies)

- **ORM:** `@prisma/client` (`PrismaClient`)
- **Veritabanı:** PostgreSQL (`DATABASE_URL`)

## 3. Çekirdek Yapılandırma ve İş Mantığı (Core Business Logic)

```javascript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```
- `globalThis` üzerinde tek bir örnek saklanır.
- Geliştirme ortamında sorgu uyarıları ve hatalar konsola basılır, üretim ortamında ise yalnızca kritik hatalar loglanır.

## 4. Bağlantılı Olduğu Dosyalar

- Tüm `backend/src/lib/*` servisleri
- Tüm `backend/src/app/api/*` rotaları
