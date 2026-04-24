export const USER_UPLOAD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const EMAIL_TEMPLATE_ASSET_MIME_TYPES = [...USER_UPLOAD_IMAGE_MIME_TYPES, 'image/svg+xml'] as const
export const USER_UPLOAD_IMAGE_ACCEPT = USER_UPLOAD_IMAGE_MIME_TYPES.join(',')

export type XEmbedTheme = 'light' | 'dark'

export interface ParsedXPostUrl {
  handle: string
  postId: string
  canonicalUrl: string
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '')
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

export function deriveImageAltText(fileName: string) {
  const normalized = stripFileExtension(fileName)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length > 0 ? normalized : 'Uploaded image'
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function extractYoutubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (trimmed.length === 0) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (hostname === 'youtu.be') {
      const shortId = parsed.pathname.split('/').filter(Boolean)[0]
      return shortId?.trim() ? shortId.trim() : null
    }

    if (hostname !== 'youtube.com' && hostname !== 'm.youtube.com') {
      return null
    }

    const directId = parsed.searchParams.get('v')
    if (directId?.trim()) {
      return directId.trim()
    }

    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length >= 2 && (segments[0] === 'shorts' || segments[0] === 'embed')) {
      return segments[1]?.trim() ? segments[1].trim() : null
    }
  } catch {
    return null
  }

  return null
}

export function isValidYoutubeUrl(rawUrl: string) {
  return extractYoutubeVideoId(rawUrl) !== null
}

export function getYoutubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function parseXPostUrl(rawUrl: string): ParsedXPostUrl | null {
  const trimmed = rawUrl.trim()
  if (trimmed.length === 0) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (hostname !== 'twitter.com' && hostname !== 'x.com') {
      return null
    }

    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length < 3 || segments[1] !== 'status') {
      return null
    }

    const handle = segments[0]?.trim()
    const postId = segments[2]?.trim()

    if (!handle || !postId) {
      return null
    }

    return {
      handle,
      postId,
      canonicalUrl: `https://${hostname}/${handle}/status/${postId}`,
    }
  } catch {
    return null
  }
}

export function sanitizeXDescription(value: string | null | undefined) {
  if (!value) {
    return ''
  }

  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.startsWith('@')) {
    const separatorIndex = normalized.indexOf(':')
    if (separatorIndex > -1 && separatorIndex < 40) {
      return normalized.slice(separatorIndex + 1).trim()
    }
  }

  return normalized
}

export function buildYoutubeEmbedHtml({
  url,
  thumbnailUrl,
  includePlayButton,
}: {
  url: string
  thumbnailUrl: string
  includePlayButton: boolean
}): string {
  const playButton = includePlayButton
    ? `
  <span style="position:absolute;left:50%;top:50%;width:72px;height:72px;transform:translate(-50%,-50%);border-radius:999px;background:#ff0000;box-shadow:0 10px 24px rgba(0,0,0,0.28);">
    <span style="position:absolute;left:50%;top:50%;transform:translate(-38%,-50%);width:0;height:0;border-top:14px solid transparent;border-bottom:14px solid transparent;border-left:22px solid #ffffff;"></span>
  </span>`
    : ''

  return `
<a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank" class="youtube youtubeContent" style="display:block;position:relative;text-decoration:none;line-height:0;">
  <img alt="YouTube video" src="${escapeHtml(thumbnailUrl)}" style="display:block;outline:none;border:none;text-decoration:none;margin:0;padding:0;max-width:100%;border-radius:8px;width:100%;" width="100%" />
  ${playButton}
  <div data-node-view-content="" style="white-space:pre-wrap"></div>
</a>`.trim()
}

export function buildXEmbedHtml({
  url,
  imageUrl,
  altText = "X's post",
}: {
  url: string
  imageUrl: string
  altText?: string
}): string {
  return `
<a href="${escapeHtml(url)}" rel="noopener noreferrer" target="_blank" class="twitter twitterContent" style="display:block;text-decoration:none;">
  <img alignment="left" alt="${escapeHtml(altText)}" src="${escapeHtml(imageUrl)}" style="display:block;outline:none;border:none;text-decoration:none;max-width:550px;border-radius:8px;width:100%;" width="100%" />
  <div data-node-view-content="" style="white-space:pre-wrap"></div>
</a>`.trim()
}

export function buildXWidgetEmbedHtml(embedHtml: string): string {
  const normalizedEmbedHtml = embedHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .trim()

  return `${normalizedEmbedHtml}
<script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>`.trim()
}

export function buildPreviewDocument(html: string, globalCss = '') {
  const safeHtml = html.trim()
  const styleTag = globalCss.trim().length > 0 ? `<style>${globalCss}</style>` : ''
  const hasXWidgetMarkup = /class=["'][^"']*twitter-(tweet|timeline)[^"']*["']/i.test(safeHtml)
  const hasXWidgetScript = /platform\.(x|twitter)\.com\/widgets\.js/i.test(safeHtml)
  const xWidgetScriptTag =
    hasXWidgetMarkup && !hasXWidgetScript
      ? '<script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>'
      : ''

  if (/<html[\s>]/i.test(safeHtml) || /<!doctype/i.test(safeHtml)) {
    const withHead = /<head[\s>]/i.test(safeHtml)
      ? safeHtml.replace(/<\/head>/i, `${styleTag}</head>`)
      : safeHtml.replace(/<html([^>]*)>/i, `<html$1><head>${styleTag}</head>`)

    if (xWidgetScriptTag.length === 0) {
      return withHead
    }

    return /<\/body>/i.test(withHead)
      ? withHead.replace(/<\/body>/i, `${xWidgetScriptTag}</body>`)
      : `${withHead}${xWidgetScriptTag}`
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${styleTag}
  </head>
  <body style="margin:0;min-height:100vh;background:#ffffff;">
    ${safeHtml}
    ${xWidgetScriptTag}
  </body>
</html>`
}
