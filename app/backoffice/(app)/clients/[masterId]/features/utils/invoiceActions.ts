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

/** Baixa externa disponível apenas para faturas pendentes ligadas a uma ação pendente. */
export function canMarkInvoicePaidExternally(
  invoice: Pick<
    BackofficeClientInvoice,
    "source" | "statusGroup" | "status" | "pendingActionId"
  > & { deleted?: boolean }
): boolean {
  return (
    invoice.source !== "adhesion_external" &&
    !invoice.deleted &&
    invoice.statusGroup !== "paid" &&
    invoice.status !== "WAIVED" &&
    invoice.status !== "CANCELED" &&
    invoice.status !== "FAILED" &&
    (invoice.source === "pending_action" || Boolean(invoice.pendingActionId))
  )
}
