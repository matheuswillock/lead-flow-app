export interface ResolveFeatureAccessInput {
  profileId: string
  managerId: string
}

export interface FeatureAccessResult {
  slugs: string[]
  betaSlugs: string[]
}

export interface IFeatureAccessService {
  resolveAllowedSlugs(data: ResolveFeatureAccessInput): Promise<FeatureAccessResult>
}

