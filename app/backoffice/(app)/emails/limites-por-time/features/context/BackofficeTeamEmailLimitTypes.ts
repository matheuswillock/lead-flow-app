export type TeamEmailLimitGrantItem = {
  id: string
  teamId: string
  maxEmailsPerDay: number | null
  isActive: boolean
  notes: string | null
  grantedAt: string
  team: {
    id: string
    name: string
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
}

export type TeamSearchItem = {
  id: string
  name: string
  master: {
    id: string
    fullName: string | null
    email: string
  }
}

export interface IBackofficeTeamEmailLimitContext {
  grants: TeamEmailLimitGrantItem[]
  isLoading: boolean
  error: string | null
  isGranting: boolean
  isRevokingId: string | null
  fetchItems: () => Promise<void>
  searchTeams: (query: string) => Promise<TeamSearchItem[]>
  grant: (
    teamId: string,
    maxEmailsPerDay: number | null,
    notes?: string | null
  ) => Promise<boolean>
  revoke: (grantId: string) => Promise<boolean>
}
