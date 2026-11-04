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