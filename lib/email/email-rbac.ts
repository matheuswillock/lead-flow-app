import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import { normalizeRole } from "@/lib/roles"

export type EmailTeamSettingsRbac = {
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
}

const DEFAULT_DISPATCH_ROLES = ["manager", "backoffice"]
const DEFAULT_TEMPLATE_CREATE_ROLES = ["manager", "backoffice"]

export function canDispatchEmail(
  ctx: TeamContext,
  teamSettings?: EmailTeamSettingsRbac | null
): boolean {
  const allowed = teamSettings?.dispatchAllowedRoles ?? DEFAULT_DISPATCH_ROLES
  return allowed.map(normalizeRole).includes(normalizeRole(ctx.teamMember.role))
}

export function canCreateEmailTemplate(
  ctx: TeamContext,
  teamSettings?: EmailTeamSettingsRbac | null
): boolean {
  const allowed = teamSettings?.templateCreateRoles ?? DEFAULT_TEMPLATE_CREATE_ROLES
  return allowed.map(normalizeRole).includes(normalizeRole(ctx.teamMember.role))
}
