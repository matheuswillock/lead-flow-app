export interface OperatorAccountSummary {
  id: string
  fullName: string | null
  email: string
}

export interface OperatorAccountTeam {
  id: string
  name: string
}

export interface OperatorLinkedAccount {
  masterId: string
  masterName: string | null
  masterEmail: string
  teams: OperatorAccountTeam[]
}

export interface OperatorLinkPayload {
  masterId: string
  teamIds: string[]
}

export interface IBackofficeOperatorLinksService {
  getLinks(userId: string): Promise<OperatorLinkedAccount[]>
  saveLinks(
    userId: string,
    links: OperatorLinkPayload[]
  ): Promise<{ isValid: boolean; errorMessages: string[] }>
  searchAccounts(query: string): Promise<OperatorAccountSummary[]>
  listAccountTeams(masterId: string): Promise<OperatorAccountTeam[]>
}
