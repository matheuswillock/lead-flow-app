import type { ICampanhasService } from "@/app/[supabaseId]/email/campanhas/features/services/ICampanhasService"
import type { ICampaignAnalyticsService } from "@/app/[supabaseId]/email/campanhas/features/services/CampaignAnalyticsService"
import type { IContatosService } from "@/app/[supabaseId]/email/contatos/features/services/IContatosService"
import type { IEmailSettingsService } from "@/app/[supabaseId]/email/configuracoes/features/services/IEmailSettingsService"
import type { IHistoricoService } from "@/app/[supabaseId]/email/historico/features/services/HistoricoService"
import type { ITemplateEditorService } from "@/app/[supabaseId]/email/templates/[id]/features/services/ITemplateEditorService"
import type { ITemplatesService } from "@/app/[supabaseId]/email/templates/features/services/ITemplatesService"

export type StudioEmailHostRole = "manager" | "backoffice" | "operator"

export type StudioEmailHostFlags = {
  hideRadarSegments?: boolean
  bypassCreditsCheck?: boolean
  skipBetaGate?: boolean
}

export type StudioEmailHostHrefs = {
  templateEditor: (templateId: string) => string
  templateList: string
}

export type StudioEmailHostServices = {
  campanhas: ICampanhasService
  contatos: IContatosService
  templates: ITemplatesService
  templateEditor: ITemplateEditorService
  emailSettings: IEmailSettingsService
  campaignAnalytics: ICampaignAnalyticsService
  historico: IHistoricoService
}

export type StudioEmailHost = {
  supabaseId: string
  teamId: string
  activeRole: StudioEmailHostRole
  services: StudioEmailHostServices
  hrefs: StudioEmailHostHrefs
  flags?: StudioEmailHostFlags
}
