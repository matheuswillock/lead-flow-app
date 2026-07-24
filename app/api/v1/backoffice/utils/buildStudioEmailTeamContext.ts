import { UserFunction, UserRole } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { Output } from "@/lib/output"
import { resolveTimezone } from "@/lib/dates"
import { assertMasterTeamScope } from "@/app/api/v1/backoffice/utils/assertMasterTeamScope"

export type StudioEmailTeamContextResult =
  | { ctx: TeamAccess; scope: { masterId: string; teamId: string; teamName: string }; error?: never; status?: never }
  | { ctx?: never; scope?: never; error: Output; status: number }

/**
 * Builds a TeamAccess context so backoffice staff can operate product email
 * APIs on behalf of the account master for a specific team.
 */
export async function buildStudioEmailTeamContext(
  masterId: string,
  teamId: string
): Promise<StudioEmailTeamContextResult> {
  const scopeResult = await assertMasterTeamScope(masterId, teamId)
  if (scopeResult.error) {
    return { error: scopeResult.error, status: scopeResult.status }
  }

  const master = await prisma.profile.findUnique({
    where: { id: masterId },
    select: {
      id: true,
      supabaseId: true,
      email: true,
      fullName: true,
      timezone: true,
      isMaster: true,
      managerId: true,
    },
  })

  if (!master?.supabaseId) {
    return {
      error: new Output(false, [], ["Perfil do master inválido"], null),
      status: 404,
    }
  }

  const ctx: TeamAccess = {
    supabaseId: master.supabaseId,
    teamId: scopeResult.scope.teamId,
    profileId: master.id,
    profileEmail: master.email,
    profileName: master.fullName,
    isMaster: true,
    managerId: master.managerId ?? master.id,
    canCreateAccountUsers: true,
    canManageAccountTeams: true,
    canTransferAccountLeads: true,
    canViewAllTeams: true,
    userTimezone: resolveTimezone(master.timezone),
    teamMember: {
      role: UserRole.manager,
      functions: [] as UserFunction[],
    },
  }

  return { ctx, scope: scopeResult.scope }
}
