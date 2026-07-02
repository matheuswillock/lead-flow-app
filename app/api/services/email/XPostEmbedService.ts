import {
  buildXPostEmailSnippet,
  extractTextFromOEmbedHtml,
  parseXPostUrl,
} from "@/lib/email/x-post-embed"

const OEMBED_TIMEOUT_MS = 8_000

interface TwitterOEmbedResponse {
  author_name?: string
  author_url?: string
  html?: string
  url?: string
}

export interface XPostEmbedResult {
  authorName: string
  authorUrl: string | null
  text: string
  postUrl: string
  htmlSnippet: string
}

export class XPostEmbedService {
  async resolveFromUrl(rawUrl: string): Promise<XPostEmbedResult> {
    const parsed = parseXPostUrl(rawUrl)
    if (!parsed) {
      throw new Error("URL do post do X inválida")
    }

    const oembedUrl = new URL("https://publish.twitter.com/oembed")
    oembedUrl.searchParams.set("url", parsed.postUrl)
    oembedUrl.searchParams.set("omit_script", "true")
    oembedUrl.searchParams.set("hide_thread", "true")

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OEMBED_TIMEOUT_MS)

    try {
      const response = await fetch(oembedUrl.toString(), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })

      if (!response.ok) {
        throw new Error("Não foi possível carregar o post do X")
      }

      const data = (await response.json()) as TwitterOEmbedResponse
      const authorName = data.author_name?.trim()
      const html = data.html?.trim()
      const postUrl = data.url?.trim() || parsed.postUrl

      if (!authorName || !html) {
        throw new Error("Resposta do X incompleta")
      }

      const text = extractTextFromOEmbedHtml(html)
      if (!text) {
        throw new Error("Não foi possível extrair o texto do post")
      }

      return {
        authorName,
        authorUrl: data.author_url?.trim() ?? null,
        text,
        postUrl,
        htmlSnippet: buildXPostEmailSnippet({
          authorName,
          authorUrl: data.author_url?.trim() ?? null,
          text,
          postUrl,
        }),
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Tempo esgotado ao buscar o post do X")
      }
      throw error instanceof Error ? error : new Error("Erro ao buscar post do X")
    } finally {
      clearTimeout(timeout)
    }
  }
}

export const xPostEmbedService = new XPostEmbedService()
