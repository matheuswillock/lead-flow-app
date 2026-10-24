import type { ChargeStatus } from "./charge-status"

/**
 * Destinos permitidos por origem. O ledger só avança: um evento atrasado ou fora de ordem
 * (ex.: EXPIRED depois de CONFIRMED) nunca desfaz um pagamento, e REFUNDED é terminal.
 * Cobranças encerradas sem pagamento (EXPIRED/CANCELED/FAILED) só reabrem por um pagamento
 * explícito (CONFIRMED) ou por revisão; PENDING nunca é destino.
 */
const ALLOWED_TARGETS: Readonly<Record<ChargeStatus, readonly ChargeStatus[]>> = {
  PENDING: ["CONFIRMED", "COMPLETED", "FAILED", "EXPIRED", "REFUNDED", "REVIEW", "CANCELED"],
  CONFIRMED: ["COMPLETED", "REFUNDED", "REVIEW"],
  COMPLETED: ["REFUNDED", "REVIEW"],
  FAILED: ["CONFIRMED", "REVIEW"],
  EXPIRED: ["CONFIRMED", "REVIEW"],
  CANCELED: ["CONFIRMED", "REVIEW"],
  REVIEW: ["CONFIRMED", "COMPLETED", "FAILED", "EXPIRED", "REFUNDED", "CANCELED"],
  REFUNDED: [],
}

export function canTransitionCharge(from: ChargeStatus, to: ChargeStatus): boolean {
  return ALLOWED_TARGETS[from].includes(to)
}
