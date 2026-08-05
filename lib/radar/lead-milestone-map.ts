import type { LeadStatus } from "@prisma/client"

export const LEAD_STATUS_MILESTONE_EVENT_TYPE: Partial<Record<LeadStatus, string>> = {
  new_opportunity: "lead.milestone.new_opportunity",
  invoicePayment: "lead.milestone.invoice_payment",
  future_sale: "lead.milestone.future_sale",
  contract_finalized: "lead.milestone.contract_finalized",
}

/**
 * E2: `new_opportunity` é o status de nascimento de todo lead. Milestone só
 * deve disparar em transição real (createdAt ≠ statusEnteredAt). Os outros 3
 * marcos não nascem como status inicial — seguem o mapa sem heurística.
 */
export function resolveLeadStatusMilestoneEventType(
  status: LeadStatus,
  createdAt: Date,
  statusEnteredAt: Date
): string | undefined {
  const eventType = LEAD_STATUS_MILESTONE_EVENT_TYPE[status]
  if (!eventType) return undefined

  if (
    status === "new_opportunity" &&
    createdAt.getTime() === statusEnteredAt.getTime()
  ) {
    return undefined
  }

  return eventType
}
