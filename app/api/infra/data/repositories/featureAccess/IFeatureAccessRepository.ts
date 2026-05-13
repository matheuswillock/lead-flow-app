import type {
  BackofficeFeature,
  BackofficeFeatureGrant,
  BackofficeUserSubscription,
  Profile,
  ProfileSubscription,
} from "@prisma/client"

export interface IFeatureAccessRepository {
  listActiveFeatures(): Promise<BackofficeFeature[]>
  findOwnerProfile(ownerProfileId: string): Promise<Pick<Profile, "hasPermanentSubscription" | "subscriptionStatus"> | null>
  findOwnerProfileSubscription(ownerProfileId: string): Promise<
    (Pick<ProfileSubscription, "hasPermanentSubscription" | "subscriptionStatus"> & {
      product: { slug: string } | null
    }) | null
  >
  listActiveUserSubscriptions(profileId: string): Promise<
    Array<BackofficeUserSubscription & { product: { slug: string } }>
  >
  listActiveBetaGrantsForProfile(profileId: string): Promise<Array<Pick<BackofficeFeatureGrant, "featureId">>>
}

