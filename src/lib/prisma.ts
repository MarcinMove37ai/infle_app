// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Global variable dla Prisma Client (dla development hot reloading)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Funkcja do tworzenia Prisma Client z sprawdzeniem env vars
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found. Available env vars:', Object.keys(process.env).filter(key =>
      key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('DB')
    ));
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('✅ Creating Prisma Client with DATABASE_URL');

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });
}

// Lazy initialization - Prisma Client jest tworzony dopiero gdy jest potrzebny
export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

// W development mode zachowaj instancję globalnie dla hot reloading
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;