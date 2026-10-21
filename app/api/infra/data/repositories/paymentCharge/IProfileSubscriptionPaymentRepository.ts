import type { PaymentCohort } from "@/lib/payments/types"

export type ProfileSubscriptionPaymentRecord = {
  readonly id: string
  readonly paymentCohort: string
}

export interface IProfileSubscriptionPaymentRepository {
  findByProfileId(profileId: string): Promise<ProfileSubscriptionPaymentRecord | null>
  setPaymentCohort(profileId: string, cohort: PaymentCohort): Promise<void>
}
