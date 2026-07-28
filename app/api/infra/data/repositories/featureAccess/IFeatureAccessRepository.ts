import type {
  BackofficeFeature,
  BackofficeFeatureAccessRule,
  BackofficeFeatureGrant,
  Profile,
  ProfileSubscription,
} from "@prisma/client"

export type ActiveFeatureRecord = Pick<
  BackofficeFeature,
  | "id"
  | "slug"
  | "name"
  | "parentId"
  | "inheritParentSettings"
  | "betaEnabled"
  | "accessMode"
  | "defaultAccessLevel"
  | "billedSeparately"
  | "productSlug"
> & {
  accessRules: Array<Pick<BackofficeFeatureAccessRule, "principal" | "accessLevel">>
}

export interface ActiveUserSubscriptionRecord {
  product: { featureSlugs: string[] }
}

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

export interface EmailBetaAccessContext {
  profileId: string
  managerId: string
  isMaster: boolean
  teamId: string
}

export interface IFeatureAccessRepository {
  listActiveFeatures(): Promise<ActiveFeatureRecord[]>
  findOwnerProfile(ownerProfileId: string): Promise<Pick<Profile, "hasPermanentSubscription" | "subscriptionStatus"> | null>
  findOwnerProfileSubscription(ownerProfileId: string): Promise<
    (Pick<ProfileSubscription, "hasPermanentSubscription" | "subscriptionStatus"> & {
      product: { featureSlugs: string[] } | null
    }) | null
  >
  listActiveUserSubscriptions(profileId: string): Promise<ActiveUserSubscriptionRecord[]>
  listActiveBetaGrantsForProfile(profileId: string): Promise<Array<Pick<BackofficeFeatureGrant, "featureId">>>
  resolveBetaEligibleFeatureIds(ctx: BetaEligibilityContext): Promise<Set<string>>
  resolveEmailBetaAccess(ctx: EmailBetaAccessContext): Promise<boolean>
  findCurrentUserRoleInfo(profileId: string): Promise<UserRoleInfo | null>
  findUserTypeAssignment(ownerProfileId: string): Promise<OwnerUserTypeAssignment | null>
}
