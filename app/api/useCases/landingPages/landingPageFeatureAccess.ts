import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import type { FeatureAccessTeamContext } from "@/app/api/services/featureAccess/IFeatureAccessService"

export const LANDING_PAGE_FEATURE_SLUG = "email-landing-pages"

function toFeatureAccessTeamContext(access: TeamAccess): FeatureAccessTeamContext {
  return {
    isMaster: access.isMaster,
    role: access.teamMember.role,
    functions: access.teamMember.functions,
    canManageAccountTeams: access.canManageAccountTeams,
    canCreateAccountUsers: access.canCreateAccountUsers,
  }
}

export async function hasLandingPageManagementAccess(access: TeamAccess): Promise<boolean> {
  const result = await featureAccessService.resolveAllowedSlugs({
    profileId: access.profileId,
    managerId: access.managerId,
    activeTeamId: access.teamId,
    teamContext: toFeatureAccessTeamContext(access),
  })
  return result.slugs.includes(LANDING_PAGE_FEATURE_SLUG)
}

export function hasLandingPagePublicAccess(teamId: string): Promise<boolean> {
  return featureAccessService.hasTeamFeatureAccess({
    teamId,
    featureSlug: LANDING_PAGE_FEATURE_SLUG,
  })
}
