import type { Breadcrumb, Event } from "@sentry/nextjs"

/**
 * O webhook do Abacate é autenticado só por `?webhookSecret=` na URL. Nenhum rastro nosso
 * (evento, transação, span, breadcrumb) pode carregar esse valor. A limpeza percorre o objeto
 * inteiro em vez de listar campos: o SDK grava a URL em chaves que mudam entre versões
 * (`url.full`, `http.url`, `query_string`, `referer`, mensagens de exceção...), e redigir uma
 * string sem o segredo é um no-op.
 */
const REDACTED = "[redacted]"
const SECRET_PARAM = "webhookSecret"
const MAX_DEPTH = 12
const SECRET_IN_TEXT = /(^|[?&;\s"'])(webhookSecret=)[^&#\s"']*/gi

export function redactWebhookSecretInText(value: string): string {
  return value.replace(SECRET_IN_TEXT, `$1$2${REDACTED}`)
}

function isSecretParamName(name: string): boolean {
  return name.toLowerCase() === SECRET_PARAM.toLowerCase()
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isSecretPair(value: unknown[]): boolean {
  return value.length === 2 && typeof value[0] === "string" && isSecretParamName(value[0])
}

function scrubArray(value: unknown[], depth: number): unknown[] {
  if (isSecretPair(value)) return [value[0], REDACTED]
  return value.map((item) => scrubValue(item, depth + 1))
}

function scrubRecord(value: Record<string, unknown>, depth: number): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    scrubbed[key] = isSecretParamName(key) ? REDACTED : scrubValue(item, depth + 1)
  }
  return scrubbed
}

function scrubValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return value
  if (typeof value === "string") return redactWebhookSecretInText(value)
  if (Array.isArray(value)) return scrubArray(value, depth)
  if (isPlainObject(value)) return scrubRecord(value, depth)
  return value
}

/** `beforeSend` / `beforeSendTransaction`: devolve uma cópia do evento sem o `webhookSecret`. */
export function scrubWebhookSecretFromEvent<T extends Event>(event: T): T {
  return scrubValue(event, 0) as T
}

/** `beforeBreadcrumb`: cobre URLs de fetch/xhr/navigation e mensagens de console. */
export function scrubWebhookSecretFromBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return scrubValue(breadcrumb, 0) as Breadcrumb
}
