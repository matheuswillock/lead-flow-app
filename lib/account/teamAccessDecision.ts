import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"

export type TeamAccessCandidate = {
  id: string
  isPending?: boolean
  isAccessible?: boolean
}

export function resolveActiveTeamId(input: {
  currentTeamId: string | null
  teams: TeamAccessCandidate[]
}): string | null {
  const currentTeam = input.teams.find((team) => team.id === input.currentTeamId)
  if (currentTeam && !currentTeam.isPending) {
    return currentTeam.id
  }

  return (
    input.teams.find((team) => !team.isPending && team.isAccessible !== false)?.id ??
    input.teams.find((team) => !team.isPending)?.id ??
    null
  )
}

export function resolveTeamAccessDecision(input: {
  requestedGeneration: number
  responseGeneration: number
  response: AccountAccessDecision
}): AccountAccessDecision | null {
  return input.requestedGeneration === input.responseGeneration ? input.response : null
}
