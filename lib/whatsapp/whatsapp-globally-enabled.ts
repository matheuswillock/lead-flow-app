import { prisma } from "@/app/api/infra/data/prisma"

const CACHE_TTL_MS = 15 * 60 * 1000

let cache: { value: boolean; expiresAt: number } | null = null

/** @internal — only for unit tests */
export function resetWhatsAppGloballyEnabledCacheForTests(): void {
  cache = null
}

/**
 * Checks whether the WhatsApp feature is globally active in backoffice_features.
 * Result is cached for 15 minutes per function instance to avoid a DB hit on every cron tick.
 * Fails closed (returns false) on DB error so pool pressure cannot re-enable disabled crons.
 */
export async function isWhatsAppGloballyEnabled(): Promise<boolean> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.value
  }

  try {
    const feature = await prisma.backofficeFeature.findFirst({
      where: { slug: "whatsapp" },
      select: { isActive: true },
    })
    const value = feature?.isActive ?? true
    cache = { value, expiresAt: now + CACHE_TTL_MS }
    return value
  } catch (error) {
    console.error("[isWhatsAppGloballyEnabled] DB error, failing closed:", error)
    return false
  }
}
