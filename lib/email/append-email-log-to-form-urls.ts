/**
 * Injeta o ID único do disparo por destinatário (`EmailLog.id`) em links `/forms/{uuid}`.
 * Query param: `cs_el` (Corretor Studio Email Log) — análogo a PID de atribuição.
 */

export const EMAIL_LOG_FORM_QUERY_PARAM = "cs_el"

const FORM_HREF_PATTERN =
  /(href\s*=\s*)(["'])([^"']*?\/forms\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[^"']*)\2/gi

export function appendEmailLogIdToFormUrls(html: string, emailLogId: string): string {
  const token = emailLogId.trim()
  if (!token || !html.includes("/forms/")) return html

  return html.replace(FORM_HREF_PATTERN, (_match, prefix: string, quote: string, rawUrl: string) => {
    const nextUrl = appendQueryParam(rawUrl, EMAIL_LOG_FORM_QUERY_PARAM, token)
    return `${prefix}${quote}${nextUrl}${quote}`
  })
}

function appendQueryParam(rawUrl: string, key: string, value: string): string {
  try {
    const hasScheme = /^https?:\/\//i.test(rawUrl)
    const base = hasScheme ? undefined : "https://corretor.studio"
    const parsed = hasScheme ? new URL(rawUrl) : new URL(rawUrl, base)
    parsed.searchParams.set(key, value)
    if (hasScheme) return parsed.toString()
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    const joiner = rawUrl.includes("?") ? "&" : "?"
    if (new RegExp(`[?&]${key}=`).test(rawUrl)) return rawUrl
    return `${rawUrl}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  }
}
