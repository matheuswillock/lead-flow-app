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

/** Trava de reputação por time (EmailTeamSettings.sendingHealth*). */
export type TeamSendingHealthItem = {
  teamId: string
  teamName: string
  masterName: string | null
  status: string
  reason: string | null
  changedAt: string | null
}

export type SendingHealthAction = "release" | "pause"

export interface IBackofficeTeamEmailLimitContext {
  grants: TeamEmailLimitGrantItem[]
  sendingHealthByTeamId: Record<string, TeamSendingHealthItem>
  isLoading: boolean
  error: string | null
  isGranting: boolean
  isRevokingId: string | null
  isApplyingHealthTeamId: string | null
  fetchItems: () => Promise<void>
  searchTeams: (query: string) => Promise<TeamSearchItem[]>
  grant: (
    teamId: string,
    maxEmailsPerDay: number | null,
    notes?: string | null
  ) => Promise<boolean>
  revoke: (grantId: string) => Promise<boolean>
  applySendingHealthAction: (teamId: string, action: SendingHealthAction) => Promise<boolean>
}
