import type {
  TeamEmailLimitGrantRow,
  TeamSearchRow,
} from "@/app/api/infra/data/repositories/backofficeTeamEmailLimitGrant/IBackofficeTeamEmailLimitGrantRepository"

export interface IBackofficeTeamEmailLimitGrantService {
  list(): Promise<TeamEmailLimitGrantRow[]>
  searchTeams(query: string): Promise<TeamSearchRow[]>
  grant(input: {
    teamId: string
    maxEmailsPerDay: number | null
    notes?: string | null
    grantedByProfileId: string
  }): Promise<{ grant: TeamEmailLimitGrantRow } | { error: string }>
  update(
    grantId: string,
    input: {
      maxEmailsPerDay?: number | null
      notes?: string | null
      grantedByProfileId: string
    }
  ): Promise<{ grant: TeamEmailLimitGrantRow } | { error: string }>
  revoke(
    grantId: string,
    revokedByProfileId: string
  ): Promise<{ grant: TeamEmailLimitGrantRow } | { error: string }>
}
