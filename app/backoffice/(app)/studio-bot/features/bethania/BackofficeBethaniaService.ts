import { API_CLIENT_BASE } from "@/lib/route-map"
import type { BackofficeBethaniaServiceContract, BethaniaLogsResult, BethaniaOverview, BethaniaPauseInput } from "./BackofficeBethaniaTypes"

const BASE_URL = `${API_CLIENT_BASE}/backoffice/bethania`

export class BackofficeBethaniaService implements BackofficeBethaniaServiceContract {
  async getOverview(): Promise<BethaniaOverview> {
    const response = await fetch(BASE_URL, { cache: "no-store" })
    if (!response.ok) throw new Error("Não foi possível carregar o status da Bethânia.")
    return response.json() as Promise<BethaniaOverview>
  }

  async setPause(input: BethaniaPauseInput): Promise<void> {
    const response = await fetch(`${BASE_URL}/controls`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error("Não foi possível atualizar a pausa.")
  }

  async setSenderUrl(webhookUrl: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/sender`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null
      throw new Error(payload?.error ?? "Não foi possível atualizar a URL do conector.")
    }
  }

  async listLogs(input: { eventType?: string; page: number; pageSize: number }): Promise<BethaniaLogsResult> {
    const params = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize) })
    if (input.eventType) params.set("eventType", input.eventType)
    const response = await fetch(`${BASE_URL}/logs?${params}`, { cache: "no-store" })
    if (!response.ok) throw new Error("Não foi possível carregar os registros de entrega.")
    return response.json() as Promise<BethaniaLogsResult>
  }
}
