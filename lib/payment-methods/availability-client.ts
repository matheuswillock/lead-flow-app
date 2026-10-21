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
