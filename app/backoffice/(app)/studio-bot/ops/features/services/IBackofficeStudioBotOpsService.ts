import type {
  ApiOutput,
  BackofficeBotHostJob,
  BackofficeBotHostSettings,
  BethaniaWebhookResyncResult,
  HostHealth,
  HostLogsResult,
} from "../context/BackofficeStudioBotOpsTypes"

export interface IBackofficeStudioBotOpsService {
  getSettings(): Promise<BackofficeBotHostSettings>
  updateSettings(input: {
    agentBaseUrl?: string | null
    desiredHostVersion?: string | null
    n8nEnv?: Record<string, string>
    evolutionEnv?: Record<string, string>
  }): Promise<ApiOutput<{ id: string; agentBaseUrl: string | null; desiredHostVersion: string | null }>>
  exportEnvFile(): Promise<
    ApiOutput<{
      content: string
      fileName: string
      agentBaseUrl: string | null
      desiredHostVersion: string | null
      n8nEnv: Record<string, string>
      evolutionEnv: Record<string, string>
    }>
  >
  rotateToken(): Promise<ApiOutput<{ agentToken: string; settingsId: string }>>
  listJobs(): Promise<BackofficeBotHostJob[]>
  health(): Promise<ApiOutput<{ jobId: string; health: HostHealth }>>
  fetchLogs(input: {
    service: "n8n" | "api"
    tail?: number
  }): Promise<ApiOutput<HostLogsResult>>
  applyEnv(): Promise<ApiOutput<{ jobId: string }>>
  restart(service: "n8n" | "api" | "all"): Promise<ApiOutput<{ jobId: string }>>
  importWorkflows(): Promise<ApiOutput<{ jobId: string }>>
  previewResyncBethaniaWebhook(): Promise<ApiOutput<BethaniaWebhookResyncResult>>
  confirmResyncBethaniaWebhook(): Promise<ApiOutput<BethaniaWebhookResyncResult>>
  syncHost(input: {
    version: string
    packBase64: string
    packSha256: string
  }): Promise<ApiOutput<{ jobId: string }>>
}
