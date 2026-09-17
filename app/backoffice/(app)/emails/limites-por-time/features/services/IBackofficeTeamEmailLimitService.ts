import type {
  SendingHealthAction,
  TeamEmailLimitGrantItem,
  TeamSearchItem,
  TeamSendingHealthItem,
} from "../context/BackofficeTeamEmailLimitTypes"

export interface IBackofficeTeamEmailLimitService {
  list(): Promise<{ grants: TeamEmailLimitGrantItem[] }>
  searchTeams(query: string): Promise<{ teams: TeamSearchItem[] }>
  grant(
    teamId: string,
    maxEmailsPerDay: number | null,
    notes?: string | null
  ): Promise<TeamEmailLimitGrantItem>
  revoke(grantId: string): Promise<void>
  listSendingHealth(teamIds: string[]): Promise<{ teams: TeamSendingHealthItem[] }>
  applySendingHealthAction(teamId: string, action: SendingHealthAction): Promise<void>
}
