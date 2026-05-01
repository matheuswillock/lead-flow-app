import type {
  BackofficeAdhesionBillingCycle,
  BackofficeProduct,
  BackofficeSubscriptionStatus,
  BackofficeUserSubscription,
} from "@prisma/client"

export type BackofficeUserSubscriptionWithProduct = BackofficeUserSubscription & {
  product: BackofficeProduct
}

export interface UpsertBackofficeUserSubscriptionInput {
  profileId: string
  productId: string
  status: BackofficeSubscriptionStatus
  cycle?: BackofficeAdhesionBillingCycle | null
  startDate: Date
  endDate?: Date | null
  adhesionId?: string | null
}

export interface IBackofficeUserSubscriptionRepository {
  findByProfileId(profileId: string): Promise<BackofficeUserSubscriptionWithProduct[]>
  upsertForAdhesion(data: UpsertBackofficeUserSubscriptionInput): Promise<BackofficeUserSubscription>
  updateStatus(id: string, status: BackofficeSubscriptionStatus): Promise<BackofficeUserSubscription>
}
