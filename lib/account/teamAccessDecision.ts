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
  // Preserva a escolha explícita mesmo quando a assinatura daquele time está
  // restrita. O gate mostra a navegação mínima para a pessoa escolher outro
  // time; trocar silenciosamente esconderia o motivo do bloqueio e impediria
  // essa recuperação consciente.
  if (currentTeam && !currentTeam.isPending) {
    return currentTeam.id
  }

  return (
    input.teams.find((team) => !team.isPending && team.isAccessible !== false)?.id ??
    (currentTeam && !currentTeam.isPending ? currentTeam.id : null) ??
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
