import { isManagerLikeRole } from "@/lib/roles"

type TeamScopeInput = {
  masterId?: string
  accountTeamsCount?: number
  role?: string | null
  canViewAllTeams?: boolean
}

export function resolveAccountTeamsCount(
  activeTeam: TeamScopeInput | null,
  memberTeamsInAccount: number
): number {
  if (activeTeam?.accountTeamsCount != null && activeTeam.accountTeamsCount > 0) {
    return activeTeam.accountTeamsCount
  }
  return memberTeamsInAccount
}

export function computeCanUseAllTeamsScope(args: {
  isTeamMaster: boolean
  activeTeam: TeamScopeInput | null
  memberTeamsInAccount: number
}): boolean {
  const { isTeamMaster, activeTeam, memberTeamsInAccount } = args
  if (!activeTeam) return false

  const isDelegated =
    isManagerLikeRole(activeTeam.role) && activeTeam.canViewAllTeams === true
  const accountTeamsCount = resolveAccountTeamsCount(activeTeam, memberTeamsInAccount)

  return (isTeamMaster || isDelegated) && accountTeamsCount > 1
}
