import type {
  BackofficeBetaTeamScope,
  BackofficeFeature,
  BackofficeFeatureAccessLevel,
  BackofficeFeatureAccessMode,
  BackofficeFeatureAccessRule,
  BackofficeAccessPrincipal,
  BackofficeFeatureGrant,
} from "@prisma/client"

export type BetaGrantTeamSummary = {
  id: string
  name: string
}

export type BackofficeBetaGrantWithRelations = BackofficeFeatureGrant & {
  profile: {
    id: string
    fullName: string | null
    email: string
    isMaster: boolean
  }
  teams: Array<{
    team: BetaGrantTeamSummary
  }>
}

export type BackofficeFeatureWithRelations = BackofficeFeature & {
  parent: Pick<BackofficeFeature, "id" | "slug" | "name"> | null
  children: Pick<BackofficeFeature, "id" | "slug" | "name">[]
  grants: BackofficeBetaGrantWithRelations[]
  accessRules: BackofficeFeatureAccessRule[]
}

export interface CreateBackofficeFeatureInput {
  name: string
  slug: string
  description?: string | null
  parentId?: string | null
  productSlug?: string | null
  accessMode: BackofficeFeatureAccessMode
  defaultAccessLevel: BackofficeFeatureAccessLevel
  betaEnabled?: boolean
  inheritParentSettings?: boolean
  billedSeparately?: boolean
  isActive?: boolean
  sortOrder?: number
}

export interface UpdateBackofficeFeatureInput {
  name?: string
  description?: string | null
  parentId?: string | null
  productSlug?: string | null
  accessMode?: BackofficeFeatureAccessMode
  defaultAccessLevel?: BackofficeFeatureAccessLevel
  betaEnabled?: boolean
  inheritParentSettings?: boolean
  billedSeparately?: boolean
  isActive?: boolean
  sortOrder?: number
}

export interface UpsertBackofficeFeatureBetaGrantInput {
  featureId: string
  profileId: string
  accessLevel?: BackofficeFeatureAccessLevel
  betaTeamScope: BackofficeBetaTeamScope
  teamIds?: string[]
}

export interface ReplaceBackofficeFeatureAccessRuleInput {
  principal: BackofficeAccessPrincipal
  accessLevel: BackofficeFeatureAccessLevel
}

export interface PlatformUserSearchItem {
  id: string
  fullName: string | null
  email: string
  profileIconUrl: string | null
}

export interface PlatformUserSearchResult {
  items: PlatformUserSearchItem[]
  totalItems: number
}

export interface MasterProfileRecord {
  id: string
  isMaster: boolean
  role: string
}

export interface IBackofficeFeatureRepository {
  findAll(): Promise<BackofficeFeatureWithRelations[]>
  findActive(): Promise<BackofficeFeature[]>
  findById(id: string): Promise<BackofficeFeature | null>
  findBySlug(slug: string): Promise<BackofficeFeature | null>
  productSlugExists(slug: string): Promise<boolean>
  profileExists(profileId: string): Promise<boolean>
  findProfileById(profileId: string): Promise<MasterProfileRecord | null>
  validateTeamsBelongToMaster(masterId: string, teamIds: string[]): Promise<boolean>
  create(data: CreateBackofficeFeatureInput): Promise<BackofficeFeature>
  update(id: string, data: UpdateBackofficeFeatureInput): Promise<BackofficeFeature>
  delete(id: string): Promise<void>
  listAvailableSlugs(): Promise<string[]>
  searchUsers(
    query: string,
    page: number,
    pageSize: number,
    options?: { mastersOnly?: boolean }
  ): Promise<PlatformUserSearchResult>
  upsertBetaGrant(data: UpsertBackofficeFeatureBetaGrantInput): Promise<BackofficeBetaGrantWithRelations>
  upsertAccessRule(
    featureId: string,
    principal: BackofficeAccessPrincipal,
    accessLevel: BackofficeFeatureAccessLevel
  ): Promise<BackofficeFeatureAccessRule>
  deleteAccessRule(featureId: string, principal: BackofficeAccessPrincipal): Promise<void>
  replaceAccessRules(
    featureId: string,
    rules: ReplaceBackofficeFeatureAccessRuleInput[]
  ): Promise<void>
  disableBetaGrant(featureId: string, profileId: string): Promise<void>
  listBetaGrants(featureId: string): Promise<BackofficeBetaGrantWithRelations[]>
  listActiveBetaGrantsForProfile(profileId: string): Promise<Array<Pick<BackofficeFeatureGrant, "featureId">>>
}
