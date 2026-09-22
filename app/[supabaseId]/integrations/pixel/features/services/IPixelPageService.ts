import type {
  GetRadarPixelHitLogsResponse,
  RadarPixelConfigData,
  SaveRadarPixelConfigPayload,
} from "@/app/[supabaseId]/integrations/features/services/IIntegrationsService";

/**
 * Fatia ISP do `IIntegrationsService` específica do Pixel — a página só
 * precisa dos métodos de pixel, nunca do webhook legado ou do formulário de
 * captação (que também vivem naquele service compartilhado).
 */
export interface IPixelPageService {
  getRadarPixelConfig(supabaseId: string, teamId: string): Promise<RadarPixelConfigData>;
  saveRadarPixelConfig(
    supabaseId: string,
    teamId: string,
    payload: SaveRadarPixelConfigPayload
  ): Promise<RadarPixelConfigData>;
  deleteRadarPixelConfig(supabaseId: string, teamId: string): Promise<void>;
  getRadarPixelHitLogs(supabaseId: string, teamId: string): Promise<GetRadarPixelHitLogsResponse>;
}
