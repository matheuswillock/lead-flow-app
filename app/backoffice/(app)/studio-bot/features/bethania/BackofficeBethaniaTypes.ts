export type BethaniaEvent = { eventType: string; description: string; paused: boolean }
export type BethaniaLog = { id: string; eventType: string; status: string; errorCode: string | null; createdAt: string; attempts: number }
export type BethaniaOverview = {
  paused: boolean
  events: BethaniaEvent[]
  sender: { configured: boolean; health: "healthy" | "unhealthy" | "unconfigured"; webhookUrl: string | null }
}
export type BethaniaLogsResult = { logs: BethaniaLog[]; page: number; pageSize: number; total: number }
export type BethaniaPauseInput = { scope: "global"; paused: boolean } | { scope: "event"; eventType: string; paused: boolean }
export interface BackofficeBethaniaServiceContract {
  getOverview(): Promise<BethaniaOverview>
  setPause(input: BethaniaPauseInput): Promise<void>
  setSenderUrl(webhookUrl: string): Promise<void>
  listLogs(input: { eventType?: string; page: number; pageSize: number }): Promise<BethaniaLogsResult>
}
