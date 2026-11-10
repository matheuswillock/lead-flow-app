import { integrationsService } from "@/app/[supabaseId]/integrations/features/services/IntegrationsService";
import type { IGenericWebhookPageService } from "./IGenericWebhookPageService";
import type {
  GetStudioWebhookLogsResponse,
  IntegrationsBootstrapResponse,
  SaveStudioWebhookConfigPayload,
  SaveStudioWebhookConfigResponse,
} from "@/app/[supabaseId]/integrations/features/services/IIntegrationsService";

/**
 * Delega para o `integrationsService` compartilhado (mesmo boundary HTTP que
 * `StudioWebhookIntegration` já usa via `IntegrationsContext`) em vez de
 * duplicar a chamada de API — só estreita a interface para o que a página
 * do Webhook Genérico precisa (ISP).
 */
class GenericWebhookPageService implements IGenericWebhookPageService {
  getStudioWebhookConfig(supabaseId: string, teamId: string): Promise<IntegrationsBootstrapResponse> {
    return integrationsService.getStudioWebhookConfig(supabaseId, teamId);
  }

  getStudioWebhookLogs(supabaseId: string, teamId: string): Promise<GetStudioWebhookLogsResponse> {
    return integrationsService.getStudioWebhookLogs(supabaseId, teamId);
  }

  saveStudioWebhookConfig(
    supabaseId: string,
    payload: SaveStudioWebhookConfigPayload
  ): Promise<SaveStudioWebhookConfigResponse> {
    return integrationsService.saveStudioWebhookConfig(supabaseId, payload);
  }
}

export const genericWebhookPageService = new GenericWebhookPageService();
