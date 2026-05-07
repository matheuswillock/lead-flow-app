export type PublicCheckoutBillingType = "PIX" | "CREDIT_CARD"

export type PublicCheckoutStep = "summary" | "payment" | "expired" | "success"

export type PublicCheckoutInvoiceItemIcon = "master" | "users" | "team"

export interface PublicCheckoutInvoiceItem {
  icon: PublicCheckoutInvoiceItemIcon
  title: string
  description: string
  quantity: number
  unitAmountMonthly: number
  totalAmountMonthly: number
}

export interface PublicCheckoutInvoiceSummary {
  monthlyTotal: number
  cycleMonths?: number
  totalDueNow: number
  billingHint: string
}

export interface PublicCheckoutCompositionRow {
  label: string
  value: string
  emphasize?: boolean
}

export interface PublicCheckoutDetails {
  presetBillingType: PublicCheckoutBillingType
  title: string
  subtitle: string
  includedTitle: string
  includedSubtitle: string
  includedBadges?: string[]
  compositionTitle: string
  compositionRows: PublicCheckoutCompositionRow[]
  invoiceItems: PublicCheckoutInvoiceItem[]
  invoiceSummary: PublicCheckoutInvoiceSummary
  monthlyTotalLabel: string
  monthlyTotalValue: string
  totalTitle: string
  totalSubtitle: string
  totalValue: string
  totalHint: string
  startLabel: string
  startValue: string
  dueLabel: string
  dueValue: string
  issuedLabel: string
  issuedValue: string
}

export interface PublicCheckoutPayerPrefill {
  fullName: string
  email: string
  phone: string
  cpfCnpj: string
  postalCode: string
  address: string
  addressNumber: string
  neighborhood: string
  complement: string
  city: string
  state: string
}

export interface PublicCheckoutPaymentInput extends PublicCheckoutPayerPrefill {
  installments: number
  creditCard: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
}

export interface PublicCheckoutPixData {
  encodedImage: string
  payload: string
  expirationDate: string | null
}

export interface PublicCheckoutPaymentView {
  status: "pending" | "paid" | "overdue" | "expired" | "canceled" | "refused" | "error"
  billingType: PublicCheckoutBillingType
  amountLabel: string
  amountValue: string
  invoiceUrl: string | null
  pix: PublicCheckoutPixData | null
}
