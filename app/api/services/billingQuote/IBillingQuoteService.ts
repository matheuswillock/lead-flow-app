import type { BillingQuote, BillingQuoteInput } from "@/app/api/shared/billing/billingQuoteTypes"

export type {
  BillingQuote,
  BillingQuoteAdjustment,
  BillingQuoteCatalogItem,
  BillingQuoteInput,
  BillingQuoteProduct,
  BillingQuoteStatus,
} from "@/app/api/shared/billing/billingQuoteTypes"

export interface IBillingQuoteService {
  createQuote(input: BillingQuoteInput): BillingQuote
}
