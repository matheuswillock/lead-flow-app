import type {
  ApiOutput,
  BethaniaAiConfiguration,
  BethaniaAiOverview,
} from "../context/BackofficeStudioBotAiTypes"
import type { IBackofficeStudioBotAiService } from "./IBackofficeStudioBotAiService"

export class BackofficeStudioBotAiService implements IBackofficeStudioBotAiService {
  async getOverview() {
    const res = await fetch("/api/v1/backoffice/bot/ai/metrics", { cache: "no-store" })
    const data = (await res.json()) as ApiOutput<BethaniaAiOverview>
    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar métricas da IA")
    }
    return data.result
  }

  async getConfiguration() {
    const res = await fetch("/api/v1/backoffice/bot/ai/configuration", { cache: "no-store" })
    const data = (await res.json()) as ApiOutput<BethaniaAiConfiguration>
    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar configuração da IA")
    }
    return data.result
  }

  async patchConfiguration(body: Partial<BethaniaAiConfiguration>) {
    const res = await fetch("/api/v1/backoffice/bot/ai/configuration", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json() as Promise<ApiOutput<BethaniaAiConfiguration>>
  }

  async testProvider() {
    const res = await fetch("/api/v1/backoffice/bot/ai/provider/test", { method: "POST" })
    return res.json() as Promise<ApiOutput<unknown>>
  }
}
