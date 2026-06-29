import type { UserRoleInfo } from "@/app/api/infra/data/repositories/featureAccess/IFeatureAccessRepository"

export interface ResolveFeatureAccessInput {
  profileId: string
  managerId: string
  activeTeamId?: string | null
}

export interface FeatureAccessResult {
  slugs: string[]
  betaSlugs: string[]
  betaLabelSlugs: string[]
  userRole: UserRoleInfo
}

export interface IFeatureAccessService {
  resolveAllowedSlugs(data: ResolveFeatureAccessInput): Promise<FeatureAccessResult>
}

