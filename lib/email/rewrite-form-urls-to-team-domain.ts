/**
 * Troca o HOST dos links de formulário NATIVO do HTML de campanha para o
 * domínio de formulários do time NO MOMENTO DO DISPARO (não na inserção do
 * link): templates antigos com o host da plataforma congelado no HTML saem
 * com o domínio do time sem migração de conteúdo.
 *
 * O CTA da campanha é dinâmico — o time pode usar link externo (ClickUp
 * Forms, Typeform, WhatsApp, site próprio). A troca só acontece quando as
 * TRÊS condições valem juntas:
 *
 * 1. o HOST do href é explicitamente nosso (host da plataforma, o próprio
 *    domínio de forms destino ou o host neutro de fallback) — ou o href é
 *    relativo (só pode ter nascido na plataforma);
 * 2. o PATH é exatamente `/forms/{publicId}` (formulário nativo);
 * 3. o formulário pertence ao time do disparo (`allowedPublicIds`).
 *
 * Qualquer outro href passa INTACTO, byte a byte. Armadilha real coberta por
 * teste: `https://forms.clickup.com/...` — matcher por substring "/forms/",
 * por prefixo "forms." de subdomínio ou por regex de path solta capturaria
 * link externo por engano; aqui a checagem é por host explícito + UUID nosso.
 */

import {
  createFormHrefPattern,
  FORM_PUBLIC_ID_PATTERN_SOURCE,
} from "@/lib/email/form-links-in-html"
import {
  getPlatformHostnames,
  normalizeHostname,
  readFormsHostEnv,
  type FormsHostEnv,
} from "@/lib/proxy/forms-host"

export type RewriteFormUrlHostsInput = {
  /** Origem destino, ex.: https://forms.imobiliariax.com.br */
  baseUrl: string
  /** publicIds (lowercase) dos formulários do time do disparo. */
  allowedPublicIds: ReadonlySet<string>
  /** Envs de host da plataforma — injetável em teste; default: process.env. */
  env?: FormsHostEnv
}

const PARSE_FALLBACK_BASE = "https://corretor.studio"

/** Path nativo exato: /forms/{uuid}, com querystring/hash livres depois. */
const NATIVE_FORM_PATH_PATTERN = new RegExp(
  `^/forms/(${FORM_PUBLIC_ID_PATTERN_SOURCE})/?$`,
  "i",
)

function buildNativeHostnames(env: FormsHostEnv, targetHostname: string | null): Set<string> {
  const hostnames = getPlatformHostnames(env)
  if (targetHostname) hostnames.add(targetHostname)
  const fallbackHostname = normalizeHostname(
    env.fallbackHost?.replace(/^https?:\/\//i, "").replace(/\/.*$/, ""),
  )
  if (fallbackHostname) hostnames.add(fallbackHostname)
  return hostnames
}

export function rewriteFormUrlHostsToBase(html: string, input: RewriteFormUrlHostsInput): string {
  if (!html.includes("/forms/") || input.allowedPublicIds.size === 0) return html

  let targetOrigin: string
  let targetHostname: string | null
  try {
    const parsedBase = new URL(input.baseUrl)
    targetOrigin = parsedBase.origin
    targetHostname = normalizeHostname(parsedBase.hostname)
  } catch {
    console.error(
      `[rewriteFormUrlHostsToBase] baseUrl inválida, mantendo HTML original: ${input.baseUrl}`,
    )
    return html
  }

  const env = input.env ?? readFormsHostEnv()
  const nativeHostnames = buildNativeHostnames(env, targetHostname)

  return html.replace(
    createFormHrefPattern(),
    (match, prefix: string, quote: string, rawUrl: string) => {
      const rewritten = rewriteSingleNativeUrl(rawUrl, {
        targetOrigin,
        nativeHostnames,
        allowedPublicIds: input.allowedPublicIds,
      })
      if (!rewritten) return match

      return `${prefix}${quote}${rewritten}${quote}`
    },
  )
}

function rewriteSingleNativeUrl(
  rawUrl: string,
  options: {
    targetOrigin: string
    nativeHostnames: ReadonlySet<string>
    allowedPublicIds: ReadonlySet<string>
  },
): string | null {
  try {
    const hasScheme = /^https?:\/\//i.test(rawUrl)
    const parsed = hasScheme ? new URL(rawUrl) : new URL(rawUrl, PARSE_FALLBACK_BASE)

    // Condição 1 — host explicitamente nosso. Href relativo só pode ter
    // nascido na plataforma; absoluto precisa bater com a lista nativa
    // (deploys .vercel.app inclusos). `forms.clickup.com` NÃO passa aqui.
    if (hasScheme) {
      const hostname = normalizeHostname(parsed.hostname)
      const isNativeHost =
        hostname != null &&
        (options.nativeHostnames.has(hostname) || hostname.endsWith(".vercel.app"))
      if (!isNativeHost) return null
    }

    // Condição 2 — path nativo exato /forms/{publicId}.
    const pathMatch = NATIVE_FORM_PATH_PATTERN.exec(parsed.pathname)
    if (!pathMatch) return null

    // Condição 3 — o formulário é do time do disparo.
    const publicId = pathMatch[1].toLowerCase()
    if (!options.allowedPublicIds.has(publicId)) return null

    return `${options.targetOrigin}/forms/${publicId}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}
