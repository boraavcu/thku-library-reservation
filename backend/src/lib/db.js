import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // Adaptör vs. yok. Standart başlatma.
  // Prisma, .env dosyasındaki DATABASE_URL'i otomatik okur.
  return new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
};

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaGlobal = prisma;
}