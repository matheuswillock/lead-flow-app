export type EmailSection =
  | "campaigns"
  | "contacts"
  | "templates"
  | "historico"
  | "configuracoes"
  | "metricas"

export type TeamOption = {
  id: string
  name: string
}

export interface BackofficeClientEmailsContextValue {
  masterId: string
  teams: TeamOption[]
  selectedTeamId: string | null
  onSelectedTeamIdChange: (teamId: string | null) => void
  canManage: boolean
  emailSection: EmailSection
  setEmailSection: (section: EmailSection) => void
  refreshKey: number
  bumpRefresh: () => void
}
