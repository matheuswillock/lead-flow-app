import type {
  ApiOutput,
  BackofficeBotHostJob,
  BackofficeBotHostSettings,
  HostHealth,
  HostLogsResult,
} from "../context/BackofficeStudioBotOpsTypes"
import type { IBackofficeStudioBotOpsService } from "./IBackofficeStudioBotOpsService"

export class BackofficeStudioBotOpsService implements IBackofficeStudioBotOpsService {
  async getSettings() {
    const res = await fetch("/api/v1/backoffice/bot/host/settings", { cache: "no-store" })
    const data = (await res.json()) as ApiOutput<{
      id: string
    } & BackofficeBotHostSettings>
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
    return res.json() as Promise<
      ApiOutput<{ id: string; agentBaseUrl: string | null; desiredHostVersion: string | null }>
    >
  }

  async rotateToken() {
    const res = await fetch("/api/v1/backoffice/bot/host/rotate-token", { method: "POST" })
    return res.json() as Promise<ApiOutput<{ agentToken: string; settingsId: string }>>
  }

  async listJobs() {
    const res = await fetch("/api/v1/backoffice/bot/host/jobs", { cache: "no-store" })
    const data = (await res.json()) as ApiOutput<{ jobs: BackofficeBotHostJob[] }>
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao listar jobs")
    }
    return data.result?.jobs ?? []
  }

  async health() {
    const res = await fetch("/api/v1/backoffice/bot/host/health", { method: "POST" })
    return res.json() as Promise<ApiOutput<{ jobId: string; health: HostHealth }>>
  }

  async fetchLogs(input: { service: "n8n" | "api"; tail?: number }) {
    const qs = new URLSearchParams({
      service: input.service,
      ...(input.tail != null ? { tail: String(input.tail) } : {}),
    })
    const res = await fetch(`/api/v1/backoffice/bot/host/logs?${qs.toString()}`, {
      cache: "no-store",
    })
    return res.json() as Promise<ApiOutput<HostLogsResult>>
  }

  async applyEnv() {
    const res = await fetch("/api/v1/backoffice/bot/host/apply", { method: "POST" })
    return res.json() as Promise<ApiOutput<{ jobId: string }>>
  }

  async restart(service: "n8n" | "api" | "all") {
    const res = await fetch("/api/v1/backoffice/bot/host/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    })
    return res.json() as Promise<ApiOutput<{ jobId: string }>>
  }

  async importWorkflows() {
    const res = await fetch("/api/v1/backoffice/bot/host/workflows/import", { method: "POST" })
    return res.json() as Promise<ApiOutput<{ jobId: string }>>
  }

  async syncHost(input: { version: string; packBase64: string; packSha256: string }) {
    const res = await fetch("/api/v1/backoffice/bot/host/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return res.json() as Promise<ApiOutput<{ jobId: string }>>
  }
}
