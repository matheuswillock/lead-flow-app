import { API_CLIENT_BASE } from "@/lib/route-map";
import type {
  IBackofficeRadarEngagementService,
  OutputLike,
  RadarEngagementConfigItem,
  RadarEngagementWeightItem,
  UpsertRadarEngagementConfigPayload,
  UpsertRadarEngagementWeightPayload,
} from "./IBackofficeRadarEngagementService";

export class BackofficeRadarEngagementService implements IBackofficeRadarEngagementService {
  async listWeights(): Promise<RadarEngagementWeightItem[]> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/radar/engagement-weights`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar pesos de engajamento");
    }
    return (data.result?.weights ?? []) as RadarEngagementWeightItem[];
  }

  async saveWeights(weights: UpsertRadarEngagementWeightPayload[]): Promise<OutputLike> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/radar/engagement-weights`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights }),
    });
    return response.json();
  }

  async getConfig(): Promise<RadarEngagementConfigItem | null> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/radar/engagement-config`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar configuração de engajamento");
    }
    return (data.result?.config ?? null) as RadarEngagementConfigItem | null;
  }

  async saveConfig(payload: UpsertRadarEngagementConfigPayload): Promise<OutputLike> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/radar/engagement-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }
}

export const backofficeRadarEngagementService = new BackofficeRadarEngagementService();
