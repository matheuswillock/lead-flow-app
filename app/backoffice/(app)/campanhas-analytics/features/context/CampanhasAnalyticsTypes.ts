// Shapes transcritos do backend REAL em develop (BackofficeCampaignAnalyticsUseCase +
// IBackofficeCampaignAnalyticsRepository), não do texto original da SPEC 05 — ver
// changelog v1.2 em "05 — Contrato de API (congelado)" para os diffs registrados.

export type CampaignAnalyticsPeriod = {
  from: string
  to: string
}

export type CampaignAnalyticsTotals = {
  dispatches: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
  leadsCreated: number
  leadsAttached: number
  leadsTotal: number
}

export type CampaignAnalyticsRates = {
  openRate: number | null
  finalScore: number | null
}

// Sem split leadsCreated/leadsAttached por time — só o total combinado
// (`leads`). Ver "A confirmar" na SPEC 11 sobre a lacuna do TeamConversionBarChart.
export type CampaignAnalyticsTeamRow = {
  teamId: string
  teamName: string
  sent: number
  leads: number
  finalScore: number | null
  openRate: number | null
}

export type CampaignAnalyticsSummary = {
  period: CampaignAnalyticsPeriod
  totals: CampaignAnalyticsTotals
  rates: CampaignAnalyticsRates
  byTeam: CampaignAnalyticsTeamRow[]
}

export type CampaignAnalyticsDispatchRow = {
  id: string
  teamId: string
  teamName: string
  templateName: string
  dispatchedAt: string
  status: string
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  errorMessage: string | null
}

export type CampaignAnalyticsDispatchPage = {
  rows: CampaignAnalyticsDispatchRow[]
  total: number
  page: number
  pageSize: number
}

export type CampaignAnalyticsDailyPoint = {
  day: string
  teamId: string
  teamName: string
  sent: number
  delivered: number
  opened: number
  clicked: number
}

export type CampaignAnalyticsDailyTotal = {
  day: string
  sent: number
  delivered: number
  opened: number
  clicked: number
}

export type CampaignAnalyticsTeamsSeries = {
  granularity: "day"
  points: CampaignAnalyticsDailyPoint[]
  total: CampaignAnalyticsDailyTotal[]
}

export type CampaignAnalyticsTemplateRow = {
  teamId: string
  teamName: string
  templateName: string
  dispatches: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  failed: number
  openRate: number | null
}

export type CampaignAnalyticsFormFunnelRow = {
  formId: string
  formName: string
  teamId: string
  teamName: string
  viewed: number
  started: number
  completed: number
  leadCreated: number
  leadAttached: number
  startRate: number | null
  closeRate: number | null
}

export const CAMPAIGN_ANALYTICS_CSV_DATASETS = ["dispatches", "templates", "forms", "series"] as const
export type CampaignAnalyticsCsvDataset = (typeof CAMPAIGN_ANALYTICS_CSV_DATASETS)[number]

export type CampaignAnalyticsTeamOption = {
  id: string
  name: string
}

export type CampaignAnalyticsFiltersState = {
  from: string
  to: string
  teamIds: string[]
}

export type CampaignAnalyticsQueryParams = {
  from: string
  to: string
  teamIds: string[]
}

export const CAMPAIGN_ANALYTICS_DISPATCHES_PAGE_SIZE = 25

export interface CampanhasAnalyticsContextType {
  draftFilters: CampaignAnalyticsFiltersState
  appliedFilters: CampaignAnalyticsFiltersState
  setDraftFilters: (filters: CampaignAnalyticsFiltersState) => void
  rangeValidationError: string | null
  teamOptions: CampaignAnalyticsTeamOption[]

  isUpdating: boolean
  hasLoadedOnce: boolean
  refresh: () => Promise<void>
  retry: () => Promise<void>

  summary: CampaignAnalyticsSummary | null
  summaryError: string | null

  series: CampaignAnalyticsTeamsSeries | null
  seriesError: string | null

  templates: CampaignAnalyticsTemplateRow[] | null
  templatesError: string | null

  formsFunnel: CampaignAnalyticsFormFunnelRow[] | null
  formsFunnelError: string | null

  dispatches: CampaignAnalyticsDispatchPage | null
  dispatchesError: string | null
  isDispatchesLoading: boolean
  setDispatchesPage: (page: number) => void
  setDispatchesPageSize: (pageSize: number) => void
  retryDispatches: () => Promise<void>

  exportCsv: (dataset: CampaignAnalyticsCsvDataset) => Promise<{ blob: Blob; filename: string }>
}
