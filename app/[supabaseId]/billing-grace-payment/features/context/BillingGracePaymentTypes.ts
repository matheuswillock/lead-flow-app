export type BillingGracePaymentQuote = {
  paymentId: string
  cycle: string
  amountCents: number
  expiresAt: string
  method: "PIX"
}

export type BillingGracePaymentRecord = {
  id: string
  status: string
  amountCents: number
  effectivePriceCents: number
  paymentInstructions: { checkoutUrl?: string; brCode?: string; brCodeBase64?: string; expiresAt?: string } | null
}

export interface IBillingGracePaymentState {
  isLoading: boolean;
  error: string | null;
  quote: BillingGracePaymentQuote | null
  payment: BillingGracePaymentRecord | null
}

export interface IBillingGracePaymentActions {
  load: () => Promise<void>;
  createPayment: () => Promise<void>
}

export interface IBillingGracePaymentContext extends IBillingGracePaymentState, IBillingGracePaymentActions {}
