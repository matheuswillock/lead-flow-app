import { Prisma } from "@prisma/client"
import { prisma } from "./prisma"

const transientPrismaErrors = new Set(["P1017", "P1001", "P1002", "P1008", "P2024"])

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options?: { retries?: number; label?: string; delayMs?: number }
): Promise<T> {
  const retries = options?.retries ?? 1
  const delayMs = options?.delayMs ?? 150
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : (error as { code?: string } | null)?.code

      const isTransient = !!code && transientPrismaErrors.has(code)
      const hasRetriesLeft = attempt < retries

      if (!isTransient || !hasRetriesLeft) {
        throw error
      }

      const label = options?.label ? ` ${options.label}` : ""
      console.warn(
        `[prisma] Transient error${label} (${code}). Retrying (${attempt + 1}/${retries})...`
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      await prisma.$connect()
    }
  }

  throw lastError
}
