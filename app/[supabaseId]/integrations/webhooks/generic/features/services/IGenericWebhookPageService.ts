import type {
  GetStudioWebhookLogsResponse,
  IntegrationsBootstrapResponse,
  SaveStudioWebhookConfigPayload,
  SaveStudioWebhookConfigResponse,
} from "@/app/[supabaseId]/integrations/features/services/IIntegrationsService";

/**
 * Fatia ISP do `IIntegrationsService` específica do Webhook Genérico — a
 * página só precisa dos métodos de configuração/logs do webhook legado,
 * nunca do pixel ou do formulário de captação, que também vivem naquele
 * service compartilhado.
 */
export interface IGenericWebhookPageService {
  getStudioWebhookConfig(supabaseId: string, teamId: string): Promise<IntegrationsBootstrapResponse>;
  getStudioWebhookLogs(supabaseId: string, teamId: string): Promise<GetStudioWebhookLogsResponse>;
  saveStudioWebhookConfig(
    supabaseId: string,
    payload: SaveStudioWebhookConfigPayload
  ): Promise<SaveStudioWebhookConfigResponse>;
}
