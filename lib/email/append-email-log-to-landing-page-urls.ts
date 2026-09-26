/** Injeta o vínculo do disparo em links públicos de landing pages de cotação. */

import { createLandingPageHrefPattern } from "@/lib/landing-pages/landing-page-links-in-html"

export const EMAIL_LOG_LANDING_PAGE_QUERY_PARAM = "cs_el"

export function appendEmailLogIdToLandingPageUrls(html: string, emailLogId: string): string {
  const token = emailLogId.trim()
  if (!token || !html.includes("/conversation/")) return html

  return html.replace(createLandingPageHrefPattern(), (_match, prefix: string, quote: string, rawUrl: string) => {
    const nextUrl = appendQueryParam(rawUrl, EMAIL_LOG_LANDING_PAGE_QUERY_PARAM, token)
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
