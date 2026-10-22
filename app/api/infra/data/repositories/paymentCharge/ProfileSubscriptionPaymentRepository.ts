import { prisma } from "@/app/api/infra/data/prisma"
import type { PaymentCohort } from "@/lib/payments/types"
import type {
  IProfileSubscriptionPaymentRepository,
  ProfileSubscriptionPaymentRecord,
} from "./IProfileSubscriptionPaymentRepository"

export class ProfileSubscriptionPaymentRepository implements IProfileSubscriptionPaymentRepository {
  findByProfileId(profileId: string): Promise<ProfileSubscriptionPaymentRecord | null> {
    return prisma.profileSubscription.findUnique({
      where: { profileId },
      select: { id: true, paymentCohort: true },
    })
  }

  async setPaymentCohort(profileId: string, cohort: PaymentCohort): Promise<void> {
    await prisma.profileSubscription.updateMany({ where: { profileId }, data: { paymentCohort: cohort } })
  }
}

export const profileSubscriptionPaymentRepository = new ProfileSubscriptionPaymentRepository()
