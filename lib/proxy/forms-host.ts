/**
 * Classificação de host para o serving multi-tenant de formulários públicos.
 *
 * Um time pode servir `/forms/*` no próprio domínio (ex.:
 * forms.imobiliariax.com.br) para isolar a reputação de link. O proxy usa
 * apenas host + path (barato, sem banco); a guarda de tenancy fica na página
 * `app/forms/[publicId]/page.tsx`.
 *
 * Três tipos de host:
 * - `platform`: hosts da própria plataforma (NEXT_PUBLIC_APP_URL, VERCEL_URL,
 *   localhost). Comportamento atual, sem restrição.
 * - `fallback`: host neutro compartilhado (env `PUBLIC_FORMS_FALLBACK_HOST`).
 *   Serve formulários de qualquer time, mas somente rotas de formulário.
 * - `custom`: qualquer outro host — domínio de formulários de um time.
 *   Somente rotas de formulário; tenancy validada na página.
 */

export type FormsHostKind = "platform" | "fallback" | "custom"

export type FormsHostEnv = {
  appUrl?: string
  vercelUrl?: string
  vercelBranchUrl?: string
  vercelProductionUrl?: string
  fallbackHost?: string
}

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "::1", "0.0.0.0"]

const PUBLIC_FORM_ID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

/** Sub-rotas públicas de API que o formulário público realmente chama. */
const PUBLIC_FORM_API_SUFFIXES = "(?:prefill|events|progress|submissions|availability)"

/**
 * Paths de API permitidos em host de formulários — tanto o caminho mascarado
 * (`/api/q/...`, ver `lib/route-map`) quanto o real (`/api/v1/...`).
 */
const ALLOWED_FORMS_HOST_API_PATTERN = new RegExp(
  `^/api/(?:q|v1)/public-forms/${PUBLIC_FORM_ID_SEGMENT}(?:/${PUBLIC_FORM_API_SUFFIXES})?/?$`,
  "i",
)

export function readFormsHostEnv(): FormsHostEnv {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercelUrl: process.env.VERCEL_URL,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
    vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    fallbackHost: process.env.PUBLIC_FORMS_FALLBACK_HOST,
  }
}

/** Lowercase, remove porta e ponto final. Retorna null para valor inválido. */
export function normalizeHostname(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null
  const trimmed = rawHost.trim().toLowerCase()
  if (!trimmed) return null

  // Host header IPv6 vem como "[::1]:3000" — preserva o miolo entre colchetes.
  const ipv6Match = /^\[([^\]]+)\](?::\d+)?$/.exec(trimmed)
  if (ipv6Match) return ipv6Match[1]

  const withoutPort = trimmed.replace(/:\d+$/, "")
  const withoutTrailingDot = withoutPort.replace(/\.$/, "")
  return withoutTrailingDot || null
}

function hostnameFromUrlLike(value: string | undefined): string | null {
  if (!value) return null
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return normalizeHostname(new URL(candidate).hostname)
  } catch {
    return null
  }
}

/** Adiciona o host e o par apex/www correspondente. */
function addWithWwwVariant(target: Set<string>, hostname: string | null) {
  if (!hostname) return
  target.add(hostname)
  if (hostname.startsWith("www.")) {
    target.add(hostname.slice(4))
  } else {
    target.add(`www.${hostname}`)
  }
}

export function getPlatformHostnames(env: FormsHostEnv = readFormsHostEnv()): Set<string> {
  const hostnames = new Set<string>()
  addWithWwwVariant(hostnames, hostnameFromUrlLike(env.appUrl))
  addWithWwwVariant(hostnames, hostnameFromUrlLike(env.vercelUrl))
  addWithWwwVariant(hostnames, hostnameFromUrlLike(env.vercelBranchUrl))
  addWithWwwVariant(hostnames, hostnameFromUrlLike(env.vercelProductionUrl))
  for (const local of LOCAL_HOSTNAMES) hostnames.add(local)
  return hostnames
}

export function classifyFormsHost(
  hostHeader: string | null | undefined,
  env: FormsHostEnv = readFormsHostEnv(),
): FormsHostKind {
  const hostname = normalizeHostname(hostHeader)
  // Sem Host legível não dá para classificar — trata como plataforma para
  // nunca quebrar tráfego legítimo (fail-open documentado).
  if (!hostname) return "platform"

  if (getPlatformHostnames(env).has(hostname)) return "platform"

  // Deploys de preview/produção da Vercel são sempre plataforma.
  if (hostname.endsWith(".vercel.app")) return "platform"

  const fallbackHostname = hostnameFromUrlLike(env.fallbackHost)
  if (fallbackHostname && hostname === fallbackHostname) return "fallback"

  return "custom"
}

/**
 * Em host de formulários (fallback/custom) só passam: páginas `/forms/*`,
 * assets do Next e as APIs públicas que o formulário chama. Todo o resto
 * redireciona para o host da plataforma.
 */
export function isPathAllowedOnFormsHost(pathname: string): boolean {
  if (pathname.startsWith("/forms/")) return true
  if (pathname.startsWith("/_next/")) return true
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true
  return ALLOWED_FORMS_HOST_API_PATTERN.test(pathname)
}

/** Base absoluta da plataforma para redirects a partir de host de formulários. */
export function getPlatformBaseUrl(env: FormsHostEnv = readFormsHostEnv()): string | null {
  if (env.appUrl && /^https?:\/\//i.test(env.appUrl)) {
    return env.appUrl.replace(/\/$/, "")
  }
  const vercelHost = hostnameFromUrlLike(env.vercelUrl)
  if (vercelHost) return `https://${vercelHost}`
  return null
}
