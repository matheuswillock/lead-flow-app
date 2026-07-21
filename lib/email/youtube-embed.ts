export interface YouTubeEmbedOptions {
  videoId: string
  width?: number
}

export function parseYouTubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    const host = url.hostname.toLowerCase()

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }

    if (!host.endsWith("youtube.com")) return null

    if (url.pathname.startsWith("/watch")) {
      const id = url.searchParams.get("v")
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }

    const pathMatch = url.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/)
    if (pathMatch?.[2]) return pathMatch[2]

    return null
  } catch {
    return null
  }
}

export function buildYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function buildYouTubeEmailSnippet({ videoId, width = 560 }: YouTubeEmbedOptions): string {
  const height = Math.round((width * 9) / 16)
  const watchUrl = buildYouTubeWatchUrl(videoId)
  const thumbnailUrl = buildYouTubeThumbnailUrl(videoId)

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${width}">
  <tr>
    <td align="center">
      <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
        <img src="${thumbnailUrl}" width="${width}" height="${height}" alt="Assistir vídeo no YouTube" style="display:block;border:0;border-radius:8px;" />
      </a>
    </td>
  </tr>
</table>`
}
