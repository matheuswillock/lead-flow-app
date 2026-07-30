import type {
  ApiOutput,
  BackofficeBotHostJob,
  BackofficeBotHostSettings,
  BethaniaWebhookResyncResult,
  HostHealth,
  HostLogsResult,
} from "../context/BackofficeStudioBotOpsTypes"
import type { IBackofficeStudioBotOpsService } from "./IBackofficeStudioBotOpsService"

export class BackofficeStudioBotOpsService implements IBackofficeStudioBotOpsService {
  private async parseResponse<T>(res: Response): Promise<ApiOutput<T>> {
    let data: ApiOutput<T>
    try {
      data = await res.json()
    } catch {
      throw new Error(`Resposta inválida do servidor (HTTP ${res.status})`)
    }
    if (!res.ok && !data?.errorMessages?.length) {
      throw new Error(`Erro HTTP ${res.status}`)
    }
    return data
  }

  async getSettings() {
    const res = await fetch("/api/v1/backoffice/bot/host/settings", { cache: "no-store" })
    const data = await this.parseResponse<{ id: string } & BackofficeBotHostSettings>(res)
    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar settings")
    }
    return data.result as BackofficeBotHostSettings
  }

  async updateSettings(input: {
    agentBaseUrl?: string | null
    desiredHostVersion?: string | null
    n8nEnv?: Record<string, string>
    evolutionEnv?: Record<string, string>
  }) {
    const res = await fetch("/api/v1/backoffice/bot/host/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return this.parseResponse<{
      id: string
      agentBaseUrl: string | null
      desiredHostVersion: string | null
    }>(res)
  }

  async exportEnvFile() {
    const res = await fetch("/api/v1/backoffice/bot/host/settings/env-file", {
      cache: "no-store",
    })
    return this.parseResponse<{
      content: string
      fileName: string
      agentBaseUrl: string | null
      desiredHostVersion: string | null
      n8nEnv: Record<string, string>
      evolutionEnv: Record<string, string>
    }>(res)
  }

  async rotateToken() {
    const res = await fetch("/api/v1/backoffice/bot/host/rotate-token", { method: "POST" })
    return this.parseResponse<{ agentToken: string; settingsId: string }>(res)
  }

  async listJobs() {
    const res = await fetch("/api/v1/backoffice/bot/host/jobs", { cache: "no-store" })
    const data = await this.parseResponse<{ jobs: BackofficeBotHostJob[] }>(res)
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar jobs")
    }
    return data.result?.jobs ?? []
  }

  async health() {
    const res = await fetch("/api/v1/backoffice/bot/host/health", { method: "POST" })
    return this.parseResponse<{ jobId: string; health: HostHealth }>(res)
  }

  async fetchLogs(input: { service: "n8n" | "api"; tail?: number }) {
    const qs = new URLSearchParams({
      service: input.service,
      ...(input.tail != null ? { tail: String(input.tail) } : {}),
    })
    const res = await fetch(`/api/v1/backoffice/bot/host/logs?${qs.toString()}`, {
      cache: "no-store",
    })
    return this.parseResponse<HostLogsResult>(res)
  }

  async applyEnv() {
    const res = await fetch("/api/v1/backoffice/bot/host/apply", { method: "POST" })
    return this.parseResponse<{ jobId: string }>(res)
  }

  async restart(service: "n8n" | "api" | "all") {
    const res = await fetch("/api/v1/backoffice/bot/host/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    })
    return this.parseResponse<{ jobId: string }>(res)
  }

  async importWorkflows() {
    const res = await fetch("/api/v1/backoffice/bot/host/workflows/import", { method: "POST" })
    return this.parseResponse<{ jobId: string }>(res)
  }

  async previewResyncBethaniaWebhook() {
    const res = await fetch("/api/v1/backoffice/bot/host/resync-bethania-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: false }),
    })
    return this.parseResponse<BethaniaWebhookResyncResult>(res)
  }

  async confirmResyncBethaniaWebhook() {
    const res = await fetch("/api/v1/backoffice/bot/host/resync-bethania-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    })
    return this.parseResponse<BethaniaWebhookResyncResult>(res)
  }

  async syncHost(input: { version: string; packBase64: string; packSha256: string }) {
    const res = await fetch("/api/v1/backoffice/bot/host/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return this.parseResponse<{ jobId: string }>(res)
  }
}
