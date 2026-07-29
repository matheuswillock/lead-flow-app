import type { StudioEmailHost } from "@/lib/email/studio-email-host-types"
import { BackofficeCampanhasService } from "./campanhas/services/BackofficeCampanhasService"
import { BackofficeCampaignAnalyticsService } from "./metricas/services/BackofficeCampaignAnalyticsService"
import { BackofficeContatosService } from "./contatos/services/BackofficeContatosService"
import { BackofficeEmailSettingsService } from "./configuracoes/services/BackofficeEmailSettingsService"
import { BackofficeHistoricoService } from "./historico/services/BackofficeHistoricoService"
import { BackofficeClientEmailTemplateEditorService } from "./templates/services/BackofficeClientEmailTemplateEditorService"
import { BackofficeTemplatesService } from "./templates/services/BackofficeTemplatesService"

export function createStudioEmailHost(masterId: string, teamId: string): StudioEmailHost {
  return {
    supabaseId: masterId,
    teamId,
    activeRole: "manager",
    services: {
      campanhas: new BackofficeCampanhasService(),
      contatos: new BackofficeContatosService(masterId, teamId),
      templates: new BackofficeTemplatesService(),
      templateEditor: new BackofficeClientEmailTemplateEditorService(),
      emailSettings: new BackofficeEmailSettingsService(masterId, teamId),
      campaignAnalytics: new BackofficeCampaignAnalyticsService(masterId, teamId),
      historico: new BackofficeHistoricoService(masterId, teamId),
    },
    hrefs: {
      templateEditor: (templateId: string) =>
        `/backoffice/clients/${masterId}/emails/templates/${templateId}?teamId=${teamId}`,
      templateList: `/backoffice/clients/${masterId}?tab=emails&teamId=${teamId}`,
    },
    flags: {
      hideRadarSegments: true,
      bypassCreditsCheck: true,
      skipBetaGate: true,
    },
  }
}
