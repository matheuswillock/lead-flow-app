import {
  SECRET_KEY_NAME_PATTERN,
  isWebhookPath,
  redactProviderSecrets,
  scrubUrl,
} from "@/lib/observability/redaction"

const MAX_DEPTH = 25
const REDACTED = "[redacted]"
/** Atributos de URL de span/transação: a query some por inteiro em requisições de webhook. */
const URL_ATTRIBUTE_KEYS = new Set([
  "url",
  "http.url",
  "url.full",
  "http.target",
  "url.path",
  "to",
  "from",
])
const QUERY_ATTRIBUTE_KEYS = new Set(["query_string", "url.query", "http.query", "query", "http.query_string"])

type Loose = Record<string, unknown>

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function webhookRequest(event: Loose): boolean {
  const request = event.request
  const url = isRecord(request) && typeof request.url === "string" ? request.url : null
  if (url && isWebhookPath(url)) return true
  return typeof event.transaction === "string" && isWebhookPath(event.transaction.split(" ").pop() ?? "")
}

function scrubQuery(value: unknown, webhook: boolean): unknown {
  if (webhook) {
    if (typeof value === "string") return ""
    if (Array.isArray(value)) return []
    if (isRecord(value)) return {}
    return value
  }
  if (typeof value === "string") return redactProviderSecrets(value)
  if (Array.isArray(value)) {
    return value.map((entry) =>
      Array.isArray(entry) && typeof entry[0] === "string" && SECRET_KEY_NAME_PATTERN.test(entry[0])
        ? [entry[0], REDACTED]
        : walk(entry, null, false, 1),
    )
  }
  return walk(value, null, false, 1)
}

function walk(value: unknown, key: string | null, webhook: boolean, depth: number): unknown {
  if (typeof value === "string") {
    if (key && URL_ATTRIBUTE_KEYS.has(key)) return scrubUrl(value)
    return redactProviderSecrets(value)
  }
  if (depth >= MAX_DEPTH) return typeof value === "object" && value !== null ? "[max-depth]" : value
  if (Array.isArray(value)) return value.map((item) => walk(item, key, webhook, depth + 1))
  if (isRecord(value)) {
    const result: Loose = {}
    for (const [childKey, child] of Object.entries(value)) {
      if (QUERY_ATTRIBUTE_KEYS.has(childKey)) result[childKey] = scrubQuery(child, webhook)
      else if (SECRET_KEY_NAME_PATTERN.test(childKey) && child !== null && typeof child !== "object") {
        result[childKey] = REDACTED
      } else result[childKey] = walk(child, childKey, webhook, depth + 1)
    }
    return result
  }
  return value
}

/**
 * `beforeSend` / `beforeSendTransaction` do Sentry: percorre o evento INTEIRO (request, spans,
 * contexts, extra, tags, breadcrumbs, exceções, atributos de transação) em qualquer profundidade,
 * mascarando chaves de provider e segredos em query string. Em requisição de webhook (decidido só
 * pelo caminho da URL) a query inteira é removida, pois carrega o segredo do provider.
 */
export function scrubSentryEvent<T extends object>(event: T): T {
  const webhook = webhookRequest(event as Loose)
  return walk(event, null, webhook, 0) as T
}

/** `beforeSendLog`: logs do console enviados ao Sentry passam pelo mesmo mascaramento. */
export function scrubSentryLog<T extends { message?: unknown }>(log: T): T {
  return walk(log, null, false, 0) as T
}
