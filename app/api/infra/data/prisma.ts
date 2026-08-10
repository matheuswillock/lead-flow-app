import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function buildDatabaseUrlWithConnectionLimit(url: string, connectionLimit: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("connection_limit", String(connectionLimit));
  return parsed.toString();
}

let importCronPrismaClient: PrismaClient | undefined;

/** Prisma client com pool maior para o cron de import (sync Radar paralelo). */
export function getImportCronPrisma(): PrismaClient {
  if (!importCronPrismaClient) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("[prisma] DATABASE_URL is required for import cron client");
    }
    const limit = Number(process.env.IMPORT_CRON_CONNECTION_LIMIT ?? 6);
    importCronPrismaClient = new PrismaClient({
      datasources: {
        db: {
          url: buildDatabaseUrlWithConnectionLimit(databaseUrl, limit),
        },
      },
    });
  }
  return importCronPrismaClient;
}

export { withPrismaRetry } from "./withPrismaRetry";

export default prisma;
