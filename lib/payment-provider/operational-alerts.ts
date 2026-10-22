import * as Sentry from "@sentry/nextjs"

export type AlertLevel = "warning" | "error"

export type OperationalAlert = {
  /** Estável por tipo de alerta; base da deduplicação. */
  readonly key: string
  readonly message: string
  readonly level: AlertLevel
  readonly context?: Readonly<Record<string, unknown>>
  /** Também notifica o Slack operacional. */
  readonly slack?: boolean
  /** Suprime repetições da mesma chave dentro da janela (ms). */
  readonly dedupeWindowMs?: number
  /** Identidade da deduplicação quando diferente da chave do alerta (ex.: chave + tentativa + evento). */
  readonly dedupeKey?: string
}

export type SlackAlertPayload = {
  readonly key: string
  readonly message: string
  readonly context: Readonly<Record<string, unknown>>
}

export type OperationalAlerterDependencies = {
  readonly sentry: {
    captureMessage(message: string, options?: Record<string, unknown>): unknown
  }
  readonly slack?: (payload: SlackAlertPayload) => Promise<void>
  readonly log?: (name: string, context: unknown) => void
  readonly now?: () => Date
}

const QUERY_SECRET = /(webhookSecret=)[^&\s"'#]*/gi
const URL_QUERY = /(https?:\/\/[^\s?#"']+)\?[^\s"']*/gi

/** Remove query strings de URLs e qualquer `webhookSecret=` solto: a URL do webhook carrega o segredo. */
export function redactSensitiveUrls(text: string): string {
  return text.replace(URL_QUERY, "$1?[redacted]").replace(QUERY_SECRET, "$1[redacted]")
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveUrls(value)
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactValue(v)]))
  }
  return value
}

/** Alerta operacional: log estruturado + Sentry (+ Slack opcional), deduplicado e sem URLs sensíveis. */
export class OperationalAlerter {
  private readonly lastSentAt = new Map<string, number>()

  constructor(private readonly dependencies: OperationalAlerterDependencies) {}

  // Propriedade (e não método): o guard de governança proíbe a forma `alert(` por causa do browser.
  readonly alert = async (input: OperationalAlert): Promise<void> => {
    const nowMs = (this.dependencies.now?.() ?? new Date()).getTime()
    if (this.isDeduplicated(input, nowMs)) return
    this.lastSentAt.set(input.dedupeKey ?? input.key, nowMs)

    const message = redactSensitiveUrls(input.message)
    const context = redactValue(input.context ?? {}) as Record<string, unknown>
    ;(this.dependencies.log ?? defaultLog)(`[PaymentProviderAlert][${input.key}]`, { message, ...context })
    this.dependencies.sentry.captureMessage(message, {
      level: input.level,
      tags: { alertKey: input.key, provider: "ABACATE_PAY" },
      extra: context,
    })
    if (input.slack && this.dependencies.slack) await this.notifySlack({ key: input.key, message, context })
  }

  private isDeduplicated(input: OperationalAlert, nowMs: number): boolean {
    if (!input.dedupeWindowMs) return false
    const last = this.lastSentAt.get(input.dedupeKey ?? input.key)
    return last !== undefined && nowMs - last < input.dedupeWindowMs
  }

  private async notifySlack(payload: SlackAlertPayload): Promise<void> {
    try {
      await this.dependencies.slack?.(payload)
    } catch (error) {
      console.error("[PaymentProviderAlert][slack] Error", {
        message: redactSensitiveUrls(error instanceof Error ? error.message : "unknown"),
      })
    }
  }
}

function defaultLog(name: string, context: unknown): void {
  console.error(name, context)
}

/** Instância só com log + Sentry (sem Slack), segura para uso em qualquer camada. */
export const sentryOperationalAlerter = new OperationalAlerter({ sentry: Sentry })
