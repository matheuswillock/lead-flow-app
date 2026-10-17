import { PaymentProviderError, sanitizeProviderError } from "@/lib/payment-provider/errors"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type ProviderRuntimeConfig = {
  readonly baseUrl: string
}

export type ProviderHttpClient = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type ProviderLogger = {
  info(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

export type PaymentProviderDependencies = {
  readonly http?: ProviderHttpClient
  readonly now?: () => Date
  readonly logger?: ProviderLogger
  readonly timeoutMs?: number
}

const defaultLogger: ProviderLogger = {
  info: () => undefined,
  error: () => undefined,
}

const MAX_TIMEOUT_MS = 2_147_483_647

export abstract class PaymentProviderBase<
  TConfig extends ProviderRuntimeConfig = ProviderRuntimeConfig,
> {
  protected readonly http: ProviderHttpClient
  protected readonly now: () => Date
  protected readonly logger: ProviderLogger
  private readonly timeoutMs: number

  protected constructor(
    readonly key: PaymentProviderKey,
    readonly environment: PaymentProviderEnvironment,
    protected readonly config: TConfig,
    dependencies: PaymentProviderDependencies = {},
  ) {
    this.http = dependencies.http ?? fetch
    this.now = dependencies.now ?? (() => new Date())
    if (
      !Number.isSafeInteger(dependencies.timeoutMs ?? 30_000) ||
      (dependencies.timeoutMs ?? 30_000) < 1 ||
      (dependencies.timeoutMs ?? 30_000) > MAX_TIMEOUT_MS
    ) {
      throw new PaymentProviderError("CONFIGURATION_INVALID", "Timeout do provider inválido")
    }
    const logger = dependencies.logger ?? defaultLogger
    this.logger = {
      info: (message, context) =>
        logger.info(redactSensitiveText(message), redactLogContext(context)),
      error: (message, context) =>
        logger.error(redactSensitiveText(message), redactLogContext(context)),
    }
    this.timeoutMs = dependencies.timeoutMs ?? 30_000
  }

  protected async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response
    const externalSignal = init.signal ?? undefined
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs)
    const signal = externalSignal ? AbortSignal.any([externalSignal, timeoutSignal]) : timeoutSignal
    try {
      if (isExternalAbort(signal, externalSignal)) {
        throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "Requisição cancelada", false)
      }
      response = await this.http(`${this.config.baseUrl}${path}`, { ...init, signal })
    } catch (error) {
      if (isExternalAbort(signal, externalSignal)) {
        throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "Requisição cancelada", false)
      }
      if (timeoutSignal.aborted || isTimeoutError(error)) {
        throw new PaymentProviderError("REMOTE_TIMEOUT", "O provedor não respondeu", true)
      }
      throw new PaymentProviderError(
        "REMOTE_REQUEST_FAILED",
        "Falha ao comunicar com o provedor",
        !externalSignal?.aborted,
      )
    }
    if (isExternalAbort(signal, externalSignal)) {
      throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "Requisição cancelada", false)
    }

    let body: unknown
    try {
      body = await readResponseJson(response, signal, externalSignal, timeoutSignal)
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error
      if (response.ok) {
        throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "Resposta inválida do provedor")
      }
      body = null
    }
    if (response.ok && body === null) {
      throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "Resposta vazia do provedor")
    }
    if (!response.ok) {
      this.logger.error("Falha segura na API do provedor", {
        provider: this.key,
        status: response.status,
        occurredAt: safeTimestamp(this.now),
      })
      throw new PaymentProviderError(
        response.status === 401 || response.status === 403
          ? "AUTHENTICATION_FAILED"
          : "REMOTE_REQUEST_FAILED",
        "O provedor recusou a operação",
        response.status === 408 || response.status === 429 || response.status >= 500,
        response.status,
        extractSafeRemoteCode(body),
      )
    }
    return body as T
  }

  protected providerError(error: unknown): PaymentProviderError {
    return sanitizeProviderError(error)
  }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
}

function extractSafeRemoteCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined
  const code = (body as { code?: unknown }).code
  return typeof code === "string" && /^[A-Z0-9_\-]{1,64}$/.test(code) ? code : undefined
}

const SENSITIVE_LOG_KEY =
  /(?:authorization|auth|api[-_. ]?key|secret|token|card[-_. ]?token|card[-_. ]?number|pan|cvv|cvc|security[-_. ]?code|password|signature|cookie|set[-_. ]?cookie|private[-_. ]?key|jwt|jwe|credential|passphrase|hmac|crypto[-_. ]?key|cryptographic[-_. ]?key|cipher[-_. ]?key|encryption|signing[-_. ]?key|session|pin|otp|key|bearer)/i

const JWT_OR_JWE_PATTERN =
  /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]*\.(?:[A-Za-z0-9_-]*\.){1,3}[A-Za-z0-9_-]*(?![A-Za-z0-9_-])/g

const PEM_BLOCK = /-----BEGIN[^-]*?-----[\s\S]*?(?:-----END[^-]*?-----|$)/g

const LABEL_CHAR = /[A-Za-z0-9_.\[\] -]/
const WHITESPACE_CHAR = /\s/

function matchSeparator(base: string, start: number): { valueStart: number } | null {
  let index = start
  while (index < base.length && WHITESPACE_CHAR.test(base[index])) index += 1
  if (base[index] === '"' || base[index] === "'") index += 1
  while (index < base.length && WHITESPACE_CHAR.test(base[index])) index += 1
  if (base[index] !== ":" && base[index] !== "=") return null
  index += 1
  while (index < base.length && WHITESPACE_CHAR.test(base[index])) index += 1
  return { valueStart: index }
}

function redactLogContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined
  return redactLogValue(context, undefined, new WeakSet<object>()) as Record<string, unknown>
}

function redactLogValue(value: unknown, key: string | undefined, seen: WeakSet<object>): unknown {
  if (key && SENSITIVE_LOG_KEY.test(key)) return "[REDACTED]"
  if (typeof value === "string") return redactSensitiveText(value)
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) return "[CIRCULAR]"
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item, undefined, seen))
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactLogValue(childValue, childKey, seen),
    ]),
  )
}

function redactSensitiveText(value: string): string {
  const base = value
    .replace(/Bearer\s+.*/gi, "Bearer [REDACTED]")
    .replace(/\bsk[-_][a-z0-9_-]+\b/gi, "[REDACTED]")
    .replace(JWT_OR_JWE_PATTERN, "[REDACTED]")
    .replace(PEM_BLOCK, "[REDACTED]")

  let result = ""
  let index = 0
  let labelStart = -1
  while (index < base.length) {
    if (LABEL_CHAR.test(base[index])) {
      if (labelStart === -1) labelStart = index
      index += 1
      continue
    }
    if (labelStart !== -1) {
      const label = base.slice(labelStart, index)
      const separator = SENSITIVE_LOG_KEY.test(label) ? matchSeparator(base, index) : null
      if (separator) {
        result += base.slice(labelStart, separator.valueStart)
        const quote = base[separator.valueStart]
        if (quote === '"' || quote === "'") {
          let end = separator.valueStart + 1
          while (end < base.length && base[end] !== quote) {
            if (base[end] === "\\") end += 1
            end += 1
          }
          if (end < base.length) {
            result += `${quote}[REDACTED]${quote}`
            index = end + 1
            labelStart = -1
            continue
          }
          result += "[REDACTED]"
          index = base.length
          labelStart = -1
          break
        }
        result += "[REDACTED]"
        const lineEnd = base.indexOf("\n", separator.valueStart)
        index = lineEnd === -1 ? base.length : lineEnd
        labelStart = -1
        continue
      }
      result += base.slice(labelStart, index)
      labelStart = -1
    }
    result += base[index]
    index += 1
  }
  if (labelStart !== -1) result += base.slice(labelStart)
  return result
}

function isExternalAbort(signal: AbortSignal, externalSignal?: AbortSignal): boolean {
  return Boolean(externalSignal?.aborted && signal.reason === externalSignal.reason)
}

function readResponseJson(
  response: Response,
  signal: AbortSignal,
  externalSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): Promise<unknown> {
  if (signal.aborted) return Promise.reject(createAbortError(signal, externalSignal, timeoutSignal))
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort)
    const onAbort = () => {
      cleanup()
      reject(createAbortError(signal, externalSignal, timeoutSignal))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    response.json().then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
  })
}

function createAbortError(
  signal: AbortSignal,
  externalSignal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
): PaymentProviderError {
  return isExternalAbort(signal, externalSignal)
    ? new PaymentProviderError("REMOTE_REQUEST_FAILED", "Requisição cancelada", false)
    : timeoutSignal.aborted
      ? new PaymentProviderError("REMOTE_TIMEOUT", "O provedor não respondeu", true)
      : new PaymentProviderError(
          "REMOTE_REQUEST_FAILED",
          "Falha ao consumir resposta do provedor",
          true,
        )
}

function safeTimestamp(now: () => Date): string {
  try {
    const date = now()
    return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}
