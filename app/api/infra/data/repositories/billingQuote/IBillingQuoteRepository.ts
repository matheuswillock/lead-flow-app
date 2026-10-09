import type {
  BillingQuoteAccess,
  BillingQuoteProjection,
} from "@/app/api/shared/billing/billingQuoteTypes"

export type { BillingQuoteAccess, BillingQuoteProjection } from "@/app/api/shared/billing/billingQuoteTypes"

export interface IBillingQuoteRepository {
  getAccessBySupabaseId(supabaseId: string): Promise<BillingQuoteAccess | null>
  getProjection(billingOwnerId: string): Promise<BillingQuoteProjection | null>
}
