import type { PaymentCharge } from "@prisma/client"
import type { ChargePurpose } from "@/lib/payments/types"

export type ChargeReversalHandler = {
  /** Reverte o efeito de domínio da finalidade. Idempotente (pode rodar de novo após falha parcial). */
  reverse(charge: PaymentCharge): Promise<void>
}

export type ChargeReversalHandlers = Partial<Record<ChargePurpose, ChargeReversalHandler>>

/**
 * Nesta rodada só há o no-op explícito para os donos já neutros: o reembolso do provider e o dono
 * (compra, regularização, adesão) seguem seus fluxos atuais. As demais finalidades NÃO têm
 * reversão e o reembolso é recusado antes de mexer no dinheiro.
 */
const OWNER_MANAGED_PURPOSES = ["PLATFORM_PURCHASE", "GRACE", "ADHESION"] as const satisfies readonly ChargePurpose[]

const ownerManagedReversal: ChargeReversalHandler = {
  async reverse() {
    // Sem efeito adicional a reverter pelo ledger nesta rodada.
  },
}

export function createChargeReversalHandlers(): ChargeReversalHandlers {
  const handlers: ChargeReversalHandlers = {}
  for (const purpose of OWNER_MANAGED_PURPOSES) handlers[purpose] = ownerManagedReversal
  return handlers
}
