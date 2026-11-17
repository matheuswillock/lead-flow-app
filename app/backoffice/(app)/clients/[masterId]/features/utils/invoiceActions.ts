import type { BackofficeClientInvoice } from "../context/BackofficeClientDetailsTypes"

/** Mesma regra da página de detalhe da fatura (`canRemoveCharge`): nunca para paga,
 * dispensada ou pago externamente; sempre para ação pendente sem cobrança ainda. */
export function canCancelInvoice(invoice: BackofficeClientInvoice): boolean {
  return (
    invoice.source !== "adhesion_external" &&
    invoice.statusGroup !== "paid" &&
    invoice.status !== "WAIVED" &&
    (invoice.statusGroup === "upcoming" ||
      invoice.statusGroup === "overdue" ||
      invoice.source === "pending_action")
  )
}
