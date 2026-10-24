import type { PaymentCharge } from "@prisma/client"
import type { ChargePurpose } from "@/lib/payments/types"

export type ChargePurposeSettlementHandler = {
  /** Aplica o efeito de domínio da finalidade. Idempotente; lançar mantém a cobrança em CONFIRMED. */
  settle(charge: PaymentCharge): Promise<void>
}

export type ChargePurposeSettlementHandlers = Partial<Record<ChargePurpose, ChargePurposeSettlementHandler>>

/**
 * Finalidades cujo dono já é neutro (compra, regularização, adesão): o efeito de domínio é
 * aplicado pelo próprio dono; a cobrança do ledger só espelha. Liquidar é no-op idempotente.
 */
const MIRRORED_PURPOSES = ["PLATFORM_PURCHASE", "GRACE", "ADHESION"] as const satisfies readonly ChargePurpose[]

/**
 * Finalidades sem aplicador de domínio nesta rodada (Rodada 2). Ficam explícitas: a liquidação
 * devolve "unsupported" e alerta, em vez de concluir sem efeito.
 */
export const UNIMPLEMENTED_SETTLEMENT_PURPOSES: readonly ChargePurpose[] = [
  "SUBSCRIPTION_RENEWAL",
  "ADD_USER",
  "ADD_TEAM",
  "CREDITS",
  "CHANGE_ORDER",
  "BACKOFFICE_CHARGE",
]

const mirroredOwnerHandler: ChargePurposeSettlementHandler = {
  async settle() {
    // O dono neutro já aplicou o efeito; nada a fazer além de fechar o espelho.
  },
}

export function createChargePurposeSettlementHandlers(): ChargePurposeSettlementHandlers {
  const handlers: ChargePurposeSettlementHandlers = {}
  for (const purpose of MIRRORED_PURPOSES) handlers[purpose] = mirroredOwnerHandler
  return handlers
}
