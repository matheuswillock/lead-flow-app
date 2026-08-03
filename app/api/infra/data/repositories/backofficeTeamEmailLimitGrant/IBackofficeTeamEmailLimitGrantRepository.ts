export type TeamEmailLimitGrantRow = {
  id: string
  teamId: string
  maxEmailsPerDay: number | null
  isActive: boolean
  notes: string | null
  grantedByProfileId: string
  grantedAt: Date
  revokedByProfileId: string | null
  revokedAt: Date | null
  team: {
    id: string
    name: string
    masterId: string
    master: {
      id: string
      fullName: string | null
      email: string
    }
  }
  grantedBy: {
    id: string
    fullName: string | null
    email: string
  }
  revokedBy: {
    id: string
    fullName: string | null
    email: string
  } | null
}

export type TeamSearchRow = {
  id: string
  name: string
  master: {
    id: string
    fullName: string | null
    email: string
  }
}

export interface IBackofficeTeamEmailLimitGrantRepository {
  listActive(): Promise<TeamEmailLimitGrantRow[]>
  findById(grantId: string): Promise<TeamEmailLimitGrantRow | null>
  findTeamById(teamId: string): Promise<{ id: string; name: string } | null>
  searchTeams(query: string, limit?: number): Promise<TeamSearchRow[]>
  upsertGrant(input: {
    teamId: string
    maxEmailsPerDay: number | null
    notes?: string | null
    grantedByProfileId: string
  }): Promise<TeamEmailLimitGrantRow>
  updateGrant(
    grantId: string,
    input: {
      maxEmailsPerDay?: number | null
      notes?: string | null
      grantedByProfileId: string
    }
  ): Promise<TeamEmailLimitGrantRow | null>
  revoke(grantId: string, revokedByProfileId: string): Promise<TeamEmailLimitGrantRow | null>
}
