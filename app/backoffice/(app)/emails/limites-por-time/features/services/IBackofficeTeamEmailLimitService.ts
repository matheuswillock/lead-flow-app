import type { TeamEmailLimitGrantItem, TeamSearchItem } from "../context/BackofficeTeamEmailLimitTypes"

export interface IBackofficeTeamEmailLimitService {
  list(): Promise<{ grants: TeamEmailLimitGrantItem[] }>
  searchTeams(query: string): Promise<{ teams: TeamSearchItem[] }>
  grant(
    teamId: string,
    maxEmailsPerDay: number | null,
    notes?: string | null
  ): Promise<TeamEmailLimitGrantItem>
  revoke(grantId: string): Promise<void>
}
