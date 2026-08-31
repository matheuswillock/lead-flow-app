// Porta administrativa read-only (DA1, SPEC 10 — Campanhas Analytics 2026-08).
// Tabelas físicas lidas por esta porta, todas SOMENTE leitura (nenhum create/update/delete):
//   - corretor_studio_email_campaign_dispatches (model EmailCampaignDispatch)
//   - corretor_studio_email_logs                (model EmailLog — agregado, nunca linha a linha com PII)
//   - corretor_studio_public_form_metric_events  (model PublicFormMetricEvent)
//   - corretor_studio_public_forms                (model PublicForm)
//   - corretor_studio_leads                       (model Lead)
//   - corretor_studio_teams                       (model Team)

// `from`/`to` chegam já resolvidos pelo UseCase (DA5): from = 00:00 UTC do dia inicial,
// to = 00:00 UTC do dia seguinte ao dia final (limite superior exclusivo).
export type CampaignAnalyticsFilter = {
  from: Date
  to: Date
  teamIds?: string[]
}

export type CampaignAnalyticsPagination = {
  page: number
  pageSize: number
}

export type DispatchRecord = {
  id: string
  teamId: string
  teamName: string
  templateName: string
  dispatchedAt: Date
  status: string
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  errorMessage: string | null
}

export type DispatchPage = {
  rows: DispatchRecord[]
  total: number
  page: number
  pageSize: number
}

export type TemplateAggregate = {
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
}

export type DailySeriesPoint = {
  day: string
  teamId: string
  teamName: string
  sent: number
  delivered: number
  opened: number
  clicked: number
}

export type FormFunnelRow = {
  formId: string
  formName: string
  teamId: string
  teamName: string
  viewed: number
  started: number
  completed: number
  leadCreated: number
  leadAttached: number
}

export type LeadsByOriginRow = {
  teamId: string
  teamName: string
  originChannel: "email_campaign" | "public_form"
  count: number
}

export interface IBackofficeCampaignAnalyticsRepository {
  aggregateDispatches(
    filter: CampaignAnalyticsFilter,
    pagination: CampaignAnalyticsPagination
  ): Promise<DispatchPage>

  aggregateByTemplate(filter: CampaignAnalyticsFilter): Promise<TemplateAggregate[]>

  dailySeries(filter: CampaignAnalyticsFilter): Promise<DailySeriesPoint[]>

  formFunnel(filter: CampaignAnalyticsFilter): Promise<FormFunnelRow[]>

  leadsByOrigin(filter: CampaignAnalyticsFilter): Promise<LeadsByOriginRow[]>
}
