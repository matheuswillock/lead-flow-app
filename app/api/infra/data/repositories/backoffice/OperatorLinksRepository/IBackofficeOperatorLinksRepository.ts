import type { UserFunction } from "@prisma/client"

export interface OperatorLinkedTeam {
  memberId: string
  teamId: string
  teamName: string
  masterId: string
  masterName: string | null
  masterEmail: string
}

export interface OperatorTeamScope {
  teamId: string
  masterId: string
}

export interface OperatorTeamMemberRef {
  memberId: string
  teamId: string
}

/**
 * Vínculo de um Operator do backoffice com times de contas de clientes.
 * O vínculo é uma linha comum de TeamMember (papel operator), sem passar pelo
 * fluxo de cobrança nem de convite usado para usuários do cliente.
 */
export interface IBackofficeOperatorLinksRepository {
  findLinkedTeams(profileId: string): Promise<OperatorLinkedTeam[]>
  findActiveTeams(teamIds: string[]): Promise<OperatorTeamScope[]>
  addTeams(
    profileId: string,
    teamIds: string[],
    functions: UserFunction[]
  ): Promise<OperatorTeamMemberRef[]>
  removeTeams(profileId: string, teamIds: string[]): Promise<OperatorTeamMemberRef[]>
  updateFunctions(profileId: string, functions: UserFunction[]): Promise<void>
}
