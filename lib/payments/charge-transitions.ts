import type { ChargeStatus } from "./charge-status"

const NEVER_RETURNS_TO = new Set<ChargeStatus>(["PENDING"])

/**
 * Regras de transição do ledger. Espelhos recebem eventos fora de ordem e repetidos:
 * o ledger só avança, nunca volta a PENDING e nunca sai de REFUNDED.
 */
export function canTransitionCharge(from: ChargeStatus, to: ChargeStatus): boolean {
  if (from === to) return false
  if (from === "REFUNDED") return false
  if (from === "COMPLETED") return to === "REFUNDED" || to === "REVIEW"
  if (NEVER_RETURNS_TO.has(to)) return false
  return true
}
