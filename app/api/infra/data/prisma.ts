import { Prisma, PrismaClient } from "@prisma/client";

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
let emailCronPrismaClient: PrismaClient | undefined;

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

/**
 * Prisma client com orçamento explícito para o cron de disparo de e-mail.
 * Default conservador (3) para não competir com o pool serverless comum
 * (`connection_limit=1`) nem com o import (default 6).
 */
export function getEmailCronPrisma(): PrismaClient {
  if (!emailCronPrismaClient) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("[prisma] DATABASE_URL is required for email cron client");
    }
    const limit = Number(process.env.EMAIL_CRON_CONNECTION_LIMIT ?? 3);
    emailCronPrismaClient = new PrismaClient({
      datasources: {
        db: {
          url: buildDatabaseUrlWithConnectionLimit(databaseUrl, limit),
        },
      },
    });
  }
  return emailCronPrismaClient;
}

const transientPrismaErrors = new Set(["P1017", "P1001", "P1002", "P1008", "P2024"]);

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options?: { retries?: number; label?: string; delayMs?: number }
): Promise<T> {
  const retries = options?.retries ?? 1;
  const delayMs = options?.delayMs ?? 150;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : (error as { code?: string } | null)?.code;

      const isTransient = !!code && transientPrismaErrors.has(code);
      const hasRetriesLeft = attempt < retries;

      if (!isTransient || !hasRetriesLeft) {
        throw error;
      }

      const label = options?.label ? ` ${options.label}` : "";
      console.warn(
        `[prisma] Transient error${label} (${code}). Retrying (${attempt + 1}/${retries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await prisma.$connect();
    }
  }

  throw lastError;
}

export default prisma;
