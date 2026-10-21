import { API_CLIENT_BASE } from "@/lib/route-map"

import type { AvailableBillingTypes, BillingType } from "./availability"

/** URL client-side (slug mascarado) do endpoint público de disponibilidade de formas de pagamento. */
export const PAYMENT_METHODS_AVAILABILITY_URL = `${API_CLIENT_BASE}/payment-methods/availability` as const

const FAIL_CLOSED: AvailableBillingTypes = ["PIX"]
const KNOWN_TYPES: readonly BillingType[] = ["PIX", "CREDIT_CARD"]

/** Campo ausente, vazio ou desconhecido vira PIX: o cartão só aparece se for declarado. */
export function normalizeAvailableBillingTypes(value: unknown): AvailableBillingTypes {
  if (!Array.isArray(value)) return [...FAIL_CLOSED]
  const known = KNOWN_TYPES.filter((type) => value.includes(type))
  return known.length > 0 ? known : [...FAIL_CLOSED]
}

export function isCardOffered(types: AvailableBillingTypes): boolean {
  return types.includes("CREDIT_CARD")
}

/** Mantém o método atual se ainda for oferecido; senão cai para PIX (ou o primeiro disponível). */
export function coerceBillingType(current: BillingType, types: AvailableBillingTypes): BillingType {
  if (types.includes(current)) return current
  return types.includes("PIX") ? "PIX" : (types[0] ?? "PIX")
}

const CACHE_TTL_MS = 60_000
let cached: { value: AvailableBillingTypes; at: number } | null = null
let inFlight: Promise<AvailableBillingTypes> | null = null

/** Versão com cache curto e in-flight guard, para vários diálogos na mesma página. */
export function loadAvailableBillingTypes(
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now
): Promise<AvailableBillingTypes> {
  if (cached && now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.value)
  if (inFlight) return inFlight
  inFlight = fetchAvailableBillingTypes(fetcher)
    .then((value) => {
      cached = { value, at: now() }
      return value
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function resetAvailableBillingTypesCache(): void {
  cached = null
  inFlight = null
}

/** Serviço compartilhado de cliente: cada service de feature chama esta função. */
export async function fetchAvailableBillingTypes(
  fetcher: typeof fetch = fetch
): Promise<AvailableBillingTypes> {
  try {
    const response = await fetcher(PAYMENT_METHODS_AVAILABILITY_URL, {
      cache: "no-store",
    })
    if (!response.ok) return [...FAIL_CLOSED]
    const body = (await response.json()) as { result?: { availableBillingTypes?: unknown } }
    return normalizeAvailableBillingTypes(body?.result?.availableBillingTypes)
  } catch {
    return [...FAIL_CLOSED]
  }
}
