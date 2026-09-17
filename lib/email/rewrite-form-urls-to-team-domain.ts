/**
 * Troca o HOST dos links `/forms/{uuid}` do HTML de campanha para o domínio
 * de formulários do time NO MOMENTO DO DISPARO (não na inserção do link):
 * templates antigos com o host da plataforma congelado no HTML saem com o
 * domínio do time sem migração de conteúdo.
 *
 * Só reescreve URL cujo formulário pertence ao time do disparo
 * (`allowedPublicIds`) — link de formulário de outro time fica intocado.
 */

import {
  createFormHrefPattern,
  extractFormPublicIdFromUrl,
} from "@/lib/email/form-links-in-html"

export type RewriteFormUrlHostsInput = {
  /** Origem destino, ex.: https://forms.imobiliariax.com.br */
  baseUrl: string
  /** publicIds (lowercase) dos formulários do time do disparo. */
  allowedPublicIds: ReadonlySet<string>
}

const PARSE_FALLBACK_BASE = "https://corretor.studio"

export function rewriteFormUrlHostsToBase(html: string, input: RewriteFormUrlHostsInput): string {
  if (!html.includes("/forms/") || input.allowedPublicIds.size === 0) return html

  let targetOrigin: string
  try {
    targetOrigin = new URL(input.baseUrl).origin
  } catch {
    console.error(
      `[rewriteFormUrlHostsToBase] baseUrl inválida, mantendo HTML original: ${input.baseUrl}`,
    )
    return html
  }

  return html.replace(
    createFormHrefPattern(),
    (match, prefix: string, quote: string, rawUrl: string) => {
      const publicId = extractFormPublicIdFromUrl(rawUrl)
      if (!publicId || !input.allowedPublicIds.has(publicId)) return match

      const rewritten = rewriteSingleUrl(rawUrl, targetOrigin)
      if (!rewritten) return match

      return `${prefix}${quote}${rewritten}${quote}`
    },
  )
}

function rewriteSingleUrl(rawUrl: string, targetOrigin: string): string | null {
  try {
    const hasScheme = /^https?:\/\//i.test(rawUrl)
    const parsed = hasScheme ? new URL(rawUrl) : new URL(rawUrl, PARSE_FALLBACK_BASE)

    const formsIndex = parsed.pathname.indexOf("/forms/")
    if (formsIndex === -1) return null
    const formsPath = parsed.pathname.slice(formsIndex)

    return `${targetOrigin}${formsPath}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}
