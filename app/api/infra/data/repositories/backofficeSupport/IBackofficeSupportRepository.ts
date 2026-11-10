export interface SupportManagerRef {
  backofficeUserId: string
  email: string
}

export interface SupportAccountTeam {
  id: string
  name: string
}

export interface SupportAccountSearchItem {
  masterId: string
  masterName: string | null
  masterEmail: string
  teams: SupportAccountTeam[]
}

export interface SupportTeamDetails {
  id: string
  name: string
  masterId: string
  masterName: string | null
  masterEmail: string
  isDefault: boolean
  createdAt: Date
  accountTeamsCount: number
}

/**
 * Acesso da equipe Corretor Studio às contas dos clientes. O Manager do
 * backoffice entra por permissão: nenhuma linha de membro é criada, então ele
 * nunca aparece nas listas do cliente.
 */
export interface IBackofficeSupportRepository {
  findActiveSupportManager(profileId: string): Promise<SupportManagerRef | null>
  searchAccounts(query: string, limit: number): Promise<SupportAccountSearchItem[]>
  findActiveTeam(teamId: string): Promise<SupportTeamDetails | null>
}
