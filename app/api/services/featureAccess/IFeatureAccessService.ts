export interface ResolveFeatureAccessInput {
  profileId: string
  managerId: string
}

export interface IFeatureAccessService {
  resolveAllowedSlugs(data: ResolveFeatureAccessInput): Promise<string[]>
}

