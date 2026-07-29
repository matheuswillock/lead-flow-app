import type { LeadStatus } from "@prisma/client"

export const LEAD_STATUS_MILESTONE_EVENT_TYPE: Partial<Record<LeadStatus, string>> = {
  new_opportunity: "lead.milestone.new_opportunity",
  invoicePayment: "lead.milestone.invoice_payment",
  future_sale: "lead.milestone.future_sale",
  contract_finalized: "lead.milestone.contract_finalized",
}
