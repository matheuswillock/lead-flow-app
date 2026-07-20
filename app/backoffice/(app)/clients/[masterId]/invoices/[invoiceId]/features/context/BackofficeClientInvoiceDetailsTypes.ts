export interface BackofficeClientInvoiceDetails {
  id: string
  invoiceIdDisplay: string
  invoiceName: string
  invoiceKind: "subscription" | "addon_user" | "addon_team" | "other"
  source: "asaas" | "pending_action"
  customerName: string
  status: string
  statusGroup: "paid" | "overdue" | "upcoming" | "other"
  value: number
  netValue: number
  originalValue: number
  interestValue: number
  billingType: string
  description: string
  dateCreated: string | null
  dueDate: string | null
  paymentDate: string | null
  confirmedDate: string | null
  invoiceNumber: string | null
  installmentNumber: number | null
  externalReference: string | null
  invoiceUrl: string | null
  bankSlipUrl: string | null
  transactionReceiptUrl: string | null
  deleted: boolean
  checkoutUrl: string | null
  pendingActionId: string | null
}
