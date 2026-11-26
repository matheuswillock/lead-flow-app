import type { PaymentMethod } from "./types"

/** O método da tentativa fica no fingerprint persistido (contrato estável da tentativa). */
export function paymentMethodFromFingerprint(fingerprint: string): PaymentMethod | null {
  try {
    const parsed = JSON.parse(fingerprint) as { method?: unknown }
    return parsed.method === "CARD" || parsed.method === "PIX" ? parsed.method : null
  } catch {
    return null
  }
}
