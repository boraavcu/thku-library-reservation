# Context: db.js

##  1. Dosyanın Amacı ve Mimari Rolü

`db.js`, Backend uygulamasının PostgreSQL veritabanıyla iletişim kurmasını sağlayan **Prisma Client Singleton (Tekil Örnek)** modülüdür.

##  2. Singleton Tasarım Deseni (`globalThis.prismaGlobal`)

Next.js geliştirme ortamında (Development) her kod değişikliğinde dosyalar yeniden derlenir (Hot Reload). Eğer her derlemede `new PrismaClient()` çağrılırsa saniyeler içinde PostgreSQL bağlantı havuzu (Connection Pool) dolar ve veritabanı kilitlenir.
- `db.js`, `globalForPrisma.prismaGlobal` kontrolü yaparak mevcut bir bağlantı varsa onu yeniden kullanır; yoksa tek bir örnek oluşturur.
- `log: ['query', 'error', 'warn']` yapılandırması ile hataları ve sorguları konsola raporlar.

##  3. Bağlantılı Olduğu Dosyalar

- Tüm `backend/src/app/api/**/route.js` dosyaları, `lifecycle.js` ve `checkRulesAcceptance.js`