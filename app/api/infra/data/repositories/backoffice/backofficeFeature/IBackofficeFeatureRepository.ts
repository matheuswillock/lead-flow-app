import type {
  BackofficeFeature,
  BackofficeFeatureAccessLevel,
  BackofficeFeatureAccessMode,
  BackofficeFeatureGrant,
} from "@prisma/client"

export type BackofficeFeatureWithRelations = BackofficeFeature & {
  parent: Pick<BackofficeFeature, "id" | "slug" | "name"> | null
  children: Pick<BackofficeFeature, "id" | "slug" | "name">[]
  grants: Array<
    BackofficeFeatureGrant & {
      profile: {
        id: string
        fullName: string | null
        email: string
      }
    }
  >
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
  isActive?: boolean
  sortOrder?: number
}

export interface UpsertBackofficeFeatureBetaGrantInput {
  featureId: string
  profileId: string
  accessLevel?: BackofficeFeatureAccessLevel
}

export interface IBackofficeFeatureRepository {
  findAll(): Promise<BackofficeFeatureWithRelations[]>
  findActive(): Promise<BackofficeFeature[]>
  findById(id: string): Promise<BackofficeFeature | null>
  findBySlug(slug: string): Promise<BackofficeFeature | null>
  productSlugExists(slug: string): Promise<boolean>
  profileExists(profileId: string): Promise<boolean>
  create(data: CreateBackofficeFeatureInput): Promise<BackofficeFeature>
  update(id: string, data: UpdateBackofficeFeatureInput): Promise<BackofficeFeature>
  delete(id: string): Promise<void>
  listAvailableSlugs(): Promise<string[]>
  upsertBetaGrant(data: UpsertBackofficeFeatureBetaGrantInput): Promise<BackofficeFeatureGrant>
  disableBetaGrant(featureId: string, profileId: string): Promise<void>
  listBetaGrants(featureId: string): Promise<BackofficeFeatureWithRelations["grants"]>
  listActiveBetaGrantsForProfile(profileId: string): Promise<Array<Pick<BackofficeFeatureGrant, "featureId">>>
}
