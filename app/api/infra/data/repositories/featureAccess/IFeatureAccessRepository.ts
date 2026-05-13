import type {
  BackofficeFeature,
  BackofficeFeatureAccessRule,
  BackofficeFeatureGrant,
  BackofficeUserSubscription,
  Profile,
  ProfileSubscription,
} from "@prisma/client"

export interface UserRoleInfo {
  isMaster: boolean
  role: string
  functions: string[]
  canManageAccountTeams: boolean
  canCreateAccountUsers: boolean
}

export interface IFeatureAccessRepository {
  listActiveFeatures(): Promise<Array<BackofficeFeature & { accessRules: BackofficeFeatureAccessRule[] }>>
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
  findCurrentUserRoleInfo(profileId: string): Promise<UserRoleInfo | null>
}
