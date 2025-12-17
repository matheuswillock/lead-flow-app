import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Logs de configuração do PostgreSQL
console.info('🔍 [PostgreSQL] Configuração carregada');
console.info('🔍 [PostgreSQL] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.info('🔍 [PostgreSQL] DIRECT_URL exists:', !!process.env.DIRECT_URL);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;