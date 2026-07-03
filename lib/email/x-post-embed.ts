const X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"])

export interface XPostEmbedInput {
  authorName: string
  authorUrl?: string | null
  text: string
  postUrl: string
}

export interface ParsedXPostUrl {
  postId: string
  postUrl: string
}

export function parseXPostUrl(rawUrl: string): ParsedXPostUrl | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    const host = url.hostname.toLowerCase()

    if (!X_HOSTS.has(host)) return null

    const match = url.pathname.match(/\/status\/(\d+)/)
    if (!match?.[1]) return null

    const canonicalHost = host.includes("twitter.com") ? "twitter.com" : "x.com"
    const postUrl = `https://${canonicalHost}${url.pathname.split("?")[0]}`

    return { postId: match[1], postUrl }
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildXPostEmailSnippet({
  authorName,
  authorUrl,
  text,
  postUrl,
}: XPostEmbedInput): string {
  const safeAuthor = escapeHtml(authorName)
  const safeText = escapeHtml(text)
  const safePostUrl = escapeHtml(postUrl)
  const authorLink = authorUrl ? escapeHtml(authorUrl) : safePostUrl

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;border:1px solid #e5e7eb;border-radius:12px;">
  <tr>
    <td style="padding:16px;font-family:Arial,Helvetica,sans-serif;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f1419;">
        <a href="${authorLink}" target="_blank" rel="noopener noreferrer" style="color:#0f1419;text-decoration:none;">${safeAuthor}</a>
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#0f1419;white-space:pre-wrap;">${safeText}</p>
      <p style="margin:0;font-size:13px;">
        <a href="${safePostUrl}" target="_blank" rel="noopener noreferrer" style="color:#1d9bf0;text-decoration:none;">Ver post no X</a>
      </p>
    </td>
  </tr>
</table>`
}

export function extractTextFromOEmbedHtml(html: string): string {
  const withoutTags = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  return withoutTags.replace(/\n{3,}/g, "\n\n").trim()
}
