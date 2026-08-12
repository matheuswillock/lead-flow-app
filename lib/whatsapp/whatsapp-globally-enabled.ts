import { prisma } from "@/app/api/infra/data/prisma"

const CACHE_TTL_MS = 15 * 60 * 1000

let cache: { value: boolean; expiresAt: number } | null = null

/** @internal — only for unit tests */
export function resetWhatsAppGloballyEnabledCacheForTests(): void {
  cache = null
}

export type WhatsAppGlobalFeatureGate =
  | { status: "enabled" }
  | { status: "disabled" }
  | { status: "lookup_failed"; error: unknown }

/**
 * Resolve o estado da feature WhatsApp no backoffice.
 * - `enabled` / `disabled`: leitura bem-sucedida (com cache de 15 min por instância)
 * - `lookup_failed`: erro de DB — fail-closed para o trabalho do cron, mas estado distinto
 *   para que rotas auditadas não tratem como skip intencional do operador
 */
export async function resolveWhatsAppGlobalFeatureGate(): Promise<WhatsAppGlobalFeatureGate> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.value ? { status: "enabled" } : { status: "disabled" }
  }

  try {
    const feature = await prisma.backofficeFeature.findFirst({
      where: { slug: "whatsapp" },
      select: { isActive: true },
    })
    const value = feature?.isActive ?? true
    cache = { value, expiresAt: now + CACHE_TTL_MS }
    return value ? { status: "enabled" } : { status: "disabled" }
  } catch (error) {
    console.error("[isWhatsAppGloballyEnabled] DB error, failing closed:", error)
    return { status: "lookup_failed", error }
  }
}

/**
 * Checks whether the WhatsApp feature is globally active in backoffice_features.
 * Result is cached for 15 minutes per function instance to avoid a DB hit on every cron tick.
 * Fails closed (returns false) on DB error so pool pressure cannot re-enable disabled crons.
 * Prefer `resolveWhatsAppGlobalFeatureGate` in cron routes so lookup failures can be audited.
 */
export async function isWhatsAppGloballyEnabled(): Promise<boolean> {
  const gate = await resolveWhatsAppGlobalFeatureGate()
  return gate.status === "enabled"
}
