import "server-only"
import { isIP } from "node:net"
import { backofficeBethaniaRepository } from "@/app/api/infra/data/repositories/backofficeBethania/PrismaBackofficeBethaniaRepository"
import type { BackofficeBethaniaRepository } from "./BackofficeBethaniaRepository"
import { assertPublicBethaniaSenderHost, type BethaniaHostResolver } from "./BethaniaSenderUrlPolicy"
import { Output } from "@/lib/output"

export const BETHANIA_AGENDA_EVENTS = [
  { eventType: "schedule.created_or_rescheduled", description: "Agendamento criado ou reagendado" },
  { eventType: "agenda.daily_0700", description: "Resumo diário da agenda às 07:00" },
  { eventType: "meeting.follow_up_1h", description: "Acompanhamento uma hora após a reunião" },
  { eventType: "agenda.overdue_1500", description: "Aviso de pendências da agenda às 15:00" },
] as const

const EVENT_TYPES = new Set<string>(BETHANIA_AGENDA_EVENTS.map(({ eventType }) => eventType))
type LogStatus = "pending" | "sending" | "sent" | "failed" | "suppressed"
const LOG_STATUSES = new Set<LogStatus>(["pending", "sending", "sent", "failed", "suppressed"])

type HealthFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Dependencies = {
  nodeEnv?: string
  fetcher?: HealthFetcher
  lookupHost?: BethaniaHostResolver
  timeoutMs?: number
}
type BackofficeBethaniaExecuteInput =
  | { operation: "overview" }
  | { operation: "set-pause"; scope: "global" | "event"; eventType?: string; paused: boolean; actorProfileId: string }
  | { operation: "set-sender-url"; webhookUrl: string; actorProfileId: string }
  | { operation: "list-logs"; eventType?: string | null; status?: string | null; page: number; pageSize: number }

export class BackofficeBethaniaUseCase {
  private readonly fetcher: HealthFetcher;
  private readonly timeoutMs: number

  constructor(
    private readonly repository: BackofficeBethaniaRepository = backofficeBethaniaRepository,
    private readonly dependencies: Dependencies = {},
  ) {
    this.fetcher = dependencies.fetcher ?? fetch
    this.timeoutMs = dependencies.timeoutMs ?? 2_000
  }

  async execute(input: BackofficeBethaniaExecuteInput): Promise<Output> {
    try {
      switch (input.operation) {
        case "overview":
          return new Output(true, [], [], await this.getOverview())
        case "set-pause": {
          const updated = await this.setPause(input)
          return updated
            ? new Output(true, [], [], { updated: true })
            : new Output(false, [], ["Evento inválido"], { status: 400 })
        }
        case "set-sender-url": {
          const sender = await this.setSenderUrl(input)
          return new Output(true, [], [], { updated: true, webhookUrl: sender.webhookUrl })
        }
        case "list-logs":
          return new Output(true, [], [], await this.listLogs(input))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno"
      const isValidationError = message === "URL do conector inválida" || message === "URL do conector não permitida"
      return new Output(false, [], [isValidationError ? message : "Erro interno"], {
        status: isValidationError ? 400 : 500,
      })
    }
  }

  async getOverview() {
    const [globalPaused, controls] = await Promise.all([
      this.repository.getGlobalPause(),
      this.repository.listEventControls(),
    ])
    const controlByType = new Map(controls.map((control) => [control.eventType, control.paused]))
    return {
      paused: globalPaused,
      events: BETHANIA_AGENDA_EVENTS.map((event) => ({ ...event, paused: controlByType.get(event.eventType) ?? false })),
      sender: await this.getSenderHealth(),
    }
  }

  async setPause(input: { scope: "global" | "event"; eventType?: string; paused: boolean; actorProfileId: string }): Promise<boolean> {
    if (typeof input.paused !== "boolean") return false
    if (input.scope === "global") {
      await this.repository.setGlobalPause({ paused: input.paused, actorProfileId: input.actorProfileId })
      return true
    }
    if (!input.eventType || !EVENT_TYPES.has(input.eventType)) return false
    await this.repository.setEventPause({
      eventType: input.eventType,
      paused: input.paused,
      actorProfileId: input.actorProfileId,
    })
    return true
  }

  async setSenderUrl(input: { webhookUrl: string; actorProfileId: string }) {
    const nodeEnv = this.dependencies.nodeEnv ?? process.env.NODE_ENV
    const webhookUrl = validateBethaniaSenderUrl(input.webhookUrl, nodeEnv)
    await assertPublicBethaniaSenderHost(webhookUrl, this.dependencies.lookupHost, nodeEnv)
    return this.repository.upsertSenderConfig({ webhookUrl, actorProfileId: input.actorProfileId })
  }

  async listLogs(input: { eventType?: string | null; status?: string | null; page: number; pageSize: number }) {
    const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1
    const pageSize = Number.isInteger(input.pageSize) ? Math.min(Math.max(input.pageSize, 1), 100) : 25
    let eventType: string | undefined
    let status: string | undefined
    if (input.eventType) {
      if (!EVENT_TYPES.has(input.eventType)) return { logs: [], page, pageSize, total: 0 }
      eventType = input.eventType
    }
    if (input.status) {
      if (!LOG_STATUSES.has(input.status as LogStatus)) return { logs: [], page, pageSize, total: 0 }
      status = input.status
    }
    const { rows, total } = await this.repository.listLogs({
      eventType,
      status,
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    return {
      logs: rows.map(({ id, eventType: rowEventType, status: rowStatus, errorCode, createdAt, attempts }) => ({
        id,
        eventType: rowEventType,
        status: rowStatus,
        errorCode,
        createdAt,
        attempts,
      })),
      page,
      pageSize,
      total,
    }
  }

  async getConfiguredSenderUrl(): Promise<string | null> {
    const saved = await this.repository.getSenderConfig()
    if (!saved) return null
    const nodeEnv = this.dependencies.nodeEnv ?? process.env.NODE_ENV
    try {
      const validatedUrl = validateBethaniaSenderUrl(saved.webhookUrl, nodeEnv)
      await assertPublicBethaniaSenderHost(validatedUrl, this.dependencies.lookupHost, nodeEnv)
      return validatedUrl
    } catch {
      return null
    }
  }

  private async getSenderHealth(): Promise<{ configured: boolean; health: "healthy" | "unhealthy" | "unconfigured"; webhookUrl: string | null }> {
    const validatedUrl = await this.getConfiguredSenderUrl()
    if (!validatedUrl) return { configured: false, health: "unconfigured", webhookUrl: null }
    const healthUrl = new URL("/healthz", validatedUrl)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetcher(healthUrl.toString(), { method: "GET", redirect: "manual", signal: controller.signal })
      return { configured: true, health: response.ok ? "healthy" : "unhealthy", webhookUrl: `${healthUrl.origin}/` }
    } catch {
      return { configured: true, health: "unhealthy", webhookUrl: `${healthUrl.origin}/` }
    } finally {
      clearTimeout(timeout)
    }
  }
}

// The authenticated backoffice setting selects the origin; the DNS/SSRF guard remains independent.
export function validateBethaniaSenderUrl(value: string, nodeEnv: string = process.env.NODE_ENV): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error("URL do conector inválida")
  }
  if (!value.trim() || (url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password ||
      url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("URL do conector inválida")
  }
  const host = (url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname).toLowerCase()
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1"
  const ipVersion = isIP(host)
  const isLiteralIp = ipVersion !== 0
  const ipv4Octets = ipVersion === 4 ? host.split(".").map(Number) : []
  const isPrivateIpv4 = ipVersion === 4 && (
    ipv4Octets[0] === 0 || ipv4Octets[0] === 10 || ipv4Octets[0] === 127 ||
    (ipv4Octets[0] === 169 && ipv4Octets[1] === 254) ||
    (ipv4Octets[0] === 172 && ipv4Octets[1] >= 16 && ipv4Octets[1] <= 31) ||
    (ipv4Octets[0] === 192 && ipv4Octets[1] === 168)
  )
  const isLocalIpv6 = ipVersion === 6 && (host === "::" || host.startsWith("fc") || host.startsWith("fd") ||
    ["fe8", "fe9", "fea", "feb"].some((prefix) => host.startsWith(prefix)))
  if (nodeEnv === "production" && isLiteralIp && (isPrivateIpv4 || isLoopback || isLocalIpv6)) {
    throw new Error("URL do conector não permitida")
  }
  if (url.protocol === "http:" && (!isLoopback || nodeEnv === "production")) {
    throw new Error("URL do conector não permitida")
  }
  return `${url.origin}/`
}

export const backofficeBethaniaUseCase = new BackofficeBethaniaUseCase()
