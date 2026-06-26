import type {
  BackofficeFeature,
  BackofficeFeatureAccessRule,
  BackofficeFeatureGrant,
  BackofficeUserSubscription,
  Profile,
  ProfileSubscription,
} from "@prisma/client"

export interface OwnerUserTypeAssignment {
  slug: string
  accessExpiresAt: string | null
}

export interface UserRoleInfo {
  isMaster: boolean
  role: string
  functions: string[]
  canManageAccountTeams: boolean
  canCreateAccountUsers: boolean
  userTypeSlug: string
  memberProActive: boolean
  memberProExpiresAt: string | null
  activeTeamId: string | null
}

export interface BetaEligibilityContext {
  profileId: string
  activeTeamId: string | null
  managerId: string | null
  isMaster: boolean
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
  resolveBetaEligibleFeatureIds(ctx: BetaEligibilityContext): Promise<Set<string>>
  findCurrentUserRoleInfo(profileId: string): Promise<UserRoleInfo | null>
  findUserTypeAssignment(ownerProfileId: string): Promise<OwnerUserTypeAssignment | null>
}
