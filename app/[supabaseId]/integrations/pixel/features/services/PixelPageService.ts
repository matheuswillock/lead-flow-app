import { integrationsService } from "@/app/[supabaseId]/integrations/features/services/IntegrationsService";
import type { IPixelPageService } from "./IPixelPageService";
import type {
  GetRadarPixelHitLogsResponse,
  RadarPixelConfigData,
  SaveRadarPixelConfigPayload,
} from "@/app/[supabaseId]/integrations/features/services/IIntegrationsService";

/**
 * Delega para o `integrationsService` compartilhado (mesmo boundary HTTP que
 * `RadarPixelIntegration`, SPEC 30, já usa via `IntegrationsContext`) em vez
 * de duplicar a chamada de API — só estreita a interface para o que a página
 * do Pixel precisa (ISP).
 */
class PixelPageService implements IPixelPageService {
  getRadarPixelConfig(supabaseId: string, teamId: string): Promise<RadarPixelConfigData> {
    return integrationsService.getRadarPixelConfig(supabaseId, teamId);
  }

  saveRadarPixelConfig(
    supabaseId: string,
    teamId: string,
    payload: SaveRadarPixelConfigPayload
  ): Promise<RadarPixelConfigData> {
    return integrationsService.saveRadarPixelConfig(supabaseId, teamId, payload);
  }

  deleteRadarPixelConfig(supabaseId: string, teamId: string): Promise<void> {
    return integrationsService.deleteRadarPixelConfig(supabaseId, teamId);
  }

  getRadarPixelHitLogs(supabaseId: string, teamId: string): Promise<GetRadarPixelHitLogsResponse> {
    return integrationsService.getRadarPixelHitLogs(supabaseId, teamId);
  }
}

export const pixelPageService = new PixelPageService();
