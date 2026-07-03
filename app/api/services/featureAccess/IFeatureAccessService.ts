import type { UserRoleInfo } from "@/app/api/infra/data/repositories/featureAccess/IFeatureAccessRepository"

/**
 * Contexto já resolvido pelo getTeamAccess. Quando presente, o serviço
 * não refaz profile.findUnique + teamMember.findUnique.
 */
export interface FeatureAccessTeamContext {
  isMaster: boolean
  role: string
  functions: string[]
  canManageAccountTeams: boolean
  canCreateAccountUsers: boolean
}

export interface ResolveFeatureAccessInput {
  profileId: string
  managerId: string
  activeTeamId?: string | null
  teamContext?: FeatureAccessTeamContext | null
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

