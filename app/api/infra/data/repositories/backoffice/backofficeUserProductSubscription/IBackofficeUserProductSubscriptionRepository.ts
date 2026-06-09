import type {
  BackofficeAdhesionBillingCycle,
  BackofficeProduct,
  BackofficeSubscriptionStatus,
  BackofficeUserProductSubscription,
} from "@prisma/client"

export type BackofficeUserProductSubscriptionWithProduct = BackofficeUserProductSubscription & {
  product: BackofficeProduct
}

export interface UpsertBackofficeUserProductSubscriptionInput {
  profileId: string
  productId: string
  status: BackofficeSubscriptionStatus
  cycle?: BackofficeAdhesionBillingCycle | null
  startDate: Date
  endDate?: Date | null
  adhesionId?: string | null
}

export interface IBackofficeUserProductSubscriptionRepository {
  findByProfileId(profileId: string): Promise<BackofficeUserProductSubscriptionWithProduct[]>
  upsertForAdhesion(data: UpsertBackofficeUserProductSubscriptionInput): Promise<BackofficeUserProductSubscription>
  updateStatus(id: string, status: BackofficeSubscriptionStatus): Promise<BackofficeUserProductSubscription>
}
