import type {
  StudioEmailCampanhasService,
  StudioEmailCampaignAnalyticsService,
  StudioEmailContatosService,
  StudioEmailHistoricoService,
  StudioEmailSettingsService,
  StudioEmailTemplateEditorService,
  StudioEmailTemplatesService,
} from "@/lib/email/studio-email-service-contracts"

export type StudioEmailHostRole = "manager" | "backoffice" | "operator"

export type StudioEmailHostFlags = {
  hideRadarSegments?: boolean
  bypassCreditsCheck?: boolean
  skipBetaGate?: boolean
  readOnly?: boolean
}

export type StudioEmailHostHrefs = {
  templateEditor: (templateId: string) => string
  templateList: string
}

export type StudioEmailHostServices = {
  campanhas: StudioEmailCampanhasService
  contatos: StudioEmailContatosService
  templates: StudioEmailTemplatesService
  templateEditor: StudioEmailTemplateEditorService
  emailSettings: StudioEmailSettingsService
  campaignAnalytics: StudioEmailCampaignAnalyticsService
  historico: StudioEmailHistoricoService
}

export type StudioEmailHost = {
  supabaseId: string
  teamId: string
  activeRole: StudioEmailHostRole
  services: StudioEmailHostServices
  hrefs: StudioEmailHostHrefs
  flags?: StudioEmailHostFlags
}
