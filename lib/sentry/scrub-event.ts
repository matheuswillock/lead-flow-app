import { redactProviderSecrets, scrubUrl } from "@/lib/observability/redaction"

type Loose = Record<string, unknown>

function scrubString(value: unknown): unknown {
  return typeof value === "string" ? redactProviderSecrets(value) : value
}

function scrubBreadcrumb(breadcrumb: Loose): Loose {
  const data = breadcrumb.data as Loose | undefined
  return {
    ...breadcrumb,
    message: scrubString(breadcrumb.message),
    ...(data
      ? {
          data: {
            ...data,
            ...(typeof data.url === "string" ? { url: scrubUrl(data.url) } : {}),
            ...(typeof data.to === "string" ? { to: scrubUrl(data.to) } : {}),
            ...(typeof data.from === "string" ? { from: scrubUrl(data.from) } : {}),
          },
        }
      : {}),
  }
}

/**
 * `beforeSend` / `beforeSendTransaction` do Sentry: remove a query de URLs de webhook (carrega o
 * segredo do provider) e mascara chaves de provider em mensagens, exceções e breadcrumbs.
 */
export function scrubSentryEvent<T extends object>(event: T): T {
  const source = event as Loose
  const next: Loose = { ...source }

  const request = source.request as Loose | undefined
  if (request) {
    const url = typeof request.url === "string" ? scrubUrl(request.url) : request.url
    const isWebhook = typeof request.url === "string" && url !== request.url
    next.request = {
      ...request,
      url,
      ...(typeof request.query_string === "string" || isWebhook
        ? { query_string: redactProviderSecrets(String(request.query_string ?? "")) }
        : {}),
      ...(isWebhook ? { query_string: "" } : {}),
    }
  }
  if (typeof source.message === "string") next.message = redactProviderSecrets(source.message)
  if (typeof source.transaction === "string") next.transaction = scrubUrl(source.transaction)

  const exception = source.exception as { values?: Loose[] } | undefined
  if (exception?.values) {
    next.exception = {
      ...exception,
      values: exception.values.map((entry) => ({ ...entry, value: scrubString(entry.value) })),
    }
  }
  if (Array.isArray(source.breadcrumbs)) {
    next.breadcrumbs = (source.breadcrumbs as Loose[]).map(scrubBreadcrumb)
  }
  return next as T
}

/** `beforeSendLog`: logs do console enviados ao Sentry passam pelo mesmo mascaramento. */
export function scrubSentryLog<T extends { message?: unknown }>(log: T): T {
  return typeof log.message === "string"
    ? { ...log, message: redactProviderSecrets(log.message) }
    : log
}
