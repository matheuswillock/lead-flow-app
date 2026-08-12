import { API_CLIENT_BASE } from "@/lib/route-map";
import type {
  IBackofficeRadarOutboxThroughputService,
  OutputLike,
  RadarOutboxThroughputSnapshot,
  UpsertRadarOutboxThroughputPayload,
} from "./IBackofficeRadarOutboxThroughputService";

export class BackofficeRadarOutboxThroughputService
  implements IBackofficeRadarOutboxThroughputService
{
  async get(): Promise<RadarOutboxThroughputSnapshot> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/radar/outbox-throughput`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar vazão do outbox Radar");
    }
    return data.result as RadarOutboxThroughputSnapshot;
  }

  async save(payload: UpsertRadarOutboxThroughputPayload): Promise<OutputLike> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/radar/outbox-throughput`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }
}

export const backofficeRadarOutboxThroughputService =
  new BackofficeRadarOutboxThroughputService();
