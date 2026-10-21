import type { IProfileSubscriptionPaymentRepository } from "@/app/api/infra/data/repositories/paymentCharge/IProfileSubscriptionPaymentRepository"
import { resolveCohortFromSubscription } from "@/lib/payments/cohort"
import type { PaymentCohort } from "@/lib/payments/types"

export class PaymentCohortService {
  constructor(
    private readonly dependencies: {
      readonly subscriptions: Pick<IProfileSubscriptionPaymentRepository, "findByProfileId">
    },
  ) {}

  async resolvePaymentCohort(profileId: string): Promise<PaymentCohort> {
    const subscription = await this.dependencies.subscriptions.findByProfileId(profileId)
    return resolveCohortFromSubscription(subscription)
  }
}
