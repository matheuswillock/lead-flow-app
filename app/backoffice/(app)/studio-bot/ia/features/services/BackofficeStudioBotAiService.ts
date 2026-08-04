import type {
  ApiOutput,
  BethaniaAiConfiguration,
  BethaniaAiOverview,
} from "../context/BackofficeStudioBotAiTypes"
import type { IBackofficeStudioBotAiService } from "./IBackofficeStudioBotAiService"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeStudioBotAiService implements IBackofficeStudioBotAiService {
  async getOverview() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/ai/metrics`, { cache: "no-store" })
    const data = (await res.json()) as ApiOutput<BethaniaAiOverview>
    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar métricas da IA")
    }
    return data.result
  }

  async getConfiguration() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/ai/configuration`, { cache: "no-store" })
    const data = (await res.json()) as ApiOutput<BethaniaAiConfiguration>
    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar configuração da IA")
    }
    return data.result
  }

  async patchConfiguration(body: Partial<BethaniaAiConfiguration>) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/ai/configuration`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json() as Promise<ApiOutput<BethaniaAiConfiguration>>
  }

  async testProvider() {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/bot/ai/provider/test`, { method: "POST" })
    return res.json() as Promise<ApiOutput<unknown>>
  }
}
