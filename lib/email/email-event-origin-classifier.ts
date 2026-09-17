/**
 * Classificador de origem de eventos de abertura/clique do webhook do Resend.
 *
 * Medição de 17/09 em produção: 100% dos opens chegavam "<60s da entrega" —
 * artefato do pipeline (occurredAt vinha de `data.created_at`, a hora de
 * criação do e-mail) somado ao fato real de que o pixel mede o pré-fetch do
 * provedor (image proxy do Gmail em 74.125.x, Apple Mail Privacy Protection,
 * scanners corporativos), não a leitura humana. Decisão do owner: origem
 * não-humana NÃO conta nas métricas de abertura ("Aberturas reais").
 *
 * LGPD: o IP entra AQUI, em memória, e morre aqui. Só a classificação
 * (`classification` + `botSource` + `uaFamily`) é persistida em
 * `EmailEvent.metadata.origin` — nunca o IP cru.
 *
 * Ordem das regras (fixa, testada em email-event-origin-classifier.test.ts):
 *   1. user-agent (proxy do Gmail, UA duplicado fóssil, scanners conhecidos)
 *   2. faixas de IP avaliadas em memória (Google/Apple, IPv4)
 *   3. reforço por delta entrega→evento < PREFETCH_DELIVERY_DELTA_MAX_SECONDS
 *   4. UA presente → human; sem sinal nenhum → unknown
 */

export type EmailEventOriginClassification = "human" | "bot" | "unknown"

export type EmailEventOriginBotSource = "gmail-proxy" | "apple-mpp" | "scanner" | "generic"

export type EmailEventOrigin = {
  classification: EmailEventOriginClassification
  botSource?: EmailEventOriginBotSource
  uaFamily?: string
}

export type ClassifyEmailEventOriginInput = {
  /** User-agent cru do payload do Resend (`data.open.userAgent` / `data.click.userAgent`). */
  userAgent?: string | null
  /** IP cru do payload — avaliado SÓ em memória; nunca persistir. */
  ipAddress?: string | null
  /** Momento real do evento (`open.timestamp` / `click.timestamp`). */
  occurredAt: Date
  /** `EmailLog.deliveredAt` já persistido; null quando a entrega ainda não chegou. */
  deliveredAt?: Date | null
}

/** Marcadores (case-insensitive) do image proxy do Gmail no user-agent. */
export const GMAIL_IMAGE_PROXY_UA_MARKERS = ["googleimageproxy", "ggpht.com"] as const

/**
 * O fetcher do Gmail se apresenta com um Chrome 42 fossilizado
 * ("Chrome/42.0.2311.135 ... Edge/12.246") — nenhum cliente real usa essa
 * versão desde 2015. Observado em produção (17/09) vindo de 74.125.x, com o
 * UA inteiro DUPLICADO na mesma string (ver
 * GMAIL_FETCHER_DUPLICATED_UA_PATTERN).
 */
export const GMAIL_FETCHER_FOSSIL_CHROME_UA_MARKER = "chrome/42.0.2311.135"

/** UA que aparece duas vezes na mesma string — assinatura do fetcher do Gmail. */
export const GMAIL_FETCHER_DUPLICATED_UA_PATTERN = /mozilla\/\d\.\d.+mozilla\/\d\.\d/i

/**
 * Scanners/sandboxes corporativos que buscam o pixel e clicam links antes do
 * destinatário (Safe Links, Proofpoint URL Defense e afins).
 */
export const KNOWN_SCANNER_UA_MARKERS = [
  "barracuda",
  "proofpoint",
  "urldefense",
  "mimecast",
  "safelinks",
  "microsoft-safelinks",
  "symantec",
  "trendmicro",
  "trend micro",
  "sophos",
  "forcepoint",
  "fireeye",
  "paloaltonetworks",
  "bitdefender",
  "kaspersky",
  "cloudmark",
  "spamexperts",
  "yahoocachesystem",
  "amazon cloudfront",
] as const

/** Faixas IPv4 do image proxy do Google (medidas nos payloads de produção). */
export const GOOGLE_PROXY_IPV4_CIDRS = [
  "74.125.0.0/16",
  "66.102.0.0/20",
  "66.249.64.0/19",
  "209.85.128.0/17",
] as const

/** Bloco IPv4 da Apple — Mail Privacy Protection busca o pixel via relays 17.x. */
export const APPLE_MPP_IPV4_CIDRS = ["17.0.0.0/8"] as const

/**
 * Reforço: evento a menos de 120s da entrega sem nenhuma outra evidência é
 * tratado como pré-fetch (bot/generic). Mesmo limiar usado no backfill
 * histórico (migration backfill-human-open-classification).
 */
export const PREFETCH_DELIVERY_DELTA_MAX_SECONDS = 120

type ParsedCidr = { base: number; mask: number }

function parseIpv4(ip: string): number | null {
  const octets = ip.split(".")
  if (octets.length !== 4) return null
  let value = 0
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) return null
    const parsed = Number(octet)
    if (parsed > 255) return null
    value = value * 256 + parsed
  }
  return value
}

function parseCidr(cidr: string): ParsedCidr | null {
  const [ip, prefixRaw] = cidr.split("/")
  const base = parseIpv4(ip ?? "")
  const prefix = Number(prefixRaw)
  if (base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null
  // 2**32 estoura o operador bitwise de 32 bits; monta a máscara por divisão.
  const mask = prefix === 0 ? 0 : Math.floor((2 ** 32 - 1) / 2 ** (32 - prefix)) * 2 ** (32 - prefix)
  return { base: Math.floor(base / 2 ** (32 - prefix)) * 2 ** (32 - prefix), mask }
}

const PARSED_CIDR_CACHE = new Map<string, ParsedCidr | null>()

function getParsedCidr(cidr: string): ParsedCidr | null {
  if (!PARSED_CIDR_CACHE.has(cidr)) {
    PARSED_CIDR_CACHE.set(cidr, parseCidr(cidr))
  }
  return PARSED_CIDR_CACHE.get(cidr) ?? null
}

/** IPv6 e entrada inválida devolvem false — as faixas conhecidas são IPv4. */
export function isIpv4InAnyCidr(
  ip: string | null | undefined,
  cidrs: readonly string[]
): boolean {
  if (!ip) return false
  const value = parseIpv4(ip.trim())
  if (value === null) return false
  return cidrs.some((cidr) => {
    const parsed = getParsedCidr(cidr)
    if (!parsed) return false
    const prefixSize = 2 ** 32 - parsed.mask
    return Math.floor(value / prefixSize) * prefixSize === parsed.base
  })
}

function matchBotUserAgent(userAgent: string): EmailEventOriginBotSource | null {
  const normalized = userAgent.toLowerCase()
  if (GMAIL_IMAGE_PROXY_UA_MARKERS.some((marker) => normalized.includes(marker))) {
    return "gmail-proxy"
  }
  if (normalized.includes(GMAIL_FETCHER_FOSSIL_CHROME_UA_MARKER)) return "gmail-proxy"
  if (GMAIL_FETCHER_DUPLICATED_UA_PATTERN.test(userAgent)) return "gmail-proxy"
  if (KNOWN_SCANNER_UA_MARKERS.some((marker) => normalized.includes(marker))) {
    return "scanner"
  }
  return null
}

function deriveUaFamily(
  userAgent: string | null | undefined,
  botSource: EmailEventOriginBotSource | null
): string | undefined {
  if (!userAgent?.trim()) return undefined
  if (botSource === "gmail-proxy") return "gmail-image-proxy"
  if (botSource === "scanner") return "scanner"
  const normalized = userAgent.toLowerCase()
  if (normalized.includes("ms-office") || normalized.includes("msoffice") || normalized.includes("outlook")) {
    return "outlook"
  }
  if (normalized.includes("thunderbird")) return "thunderbird"
  if (normalized.includes("edg/")) return "edge"
  if (normalized.includes("firefox/")) return "firefox"
  if (normalized.includes("chrome/") || normalized.includes("crios/")) return "chrome"
  if (
    normalized.includes("cfnetwork") ||
    normalized.includes("darwin") ||
    normalized.includes("applecoremedia")
  ) {
    return "apple-mail"
  }
  if (normalized.includes("safari")) return "safari"
  return "other"
}

function isWithinPrefetchWindow(occurredAt: Date, deliveredAt: Date | null | undefined): boolean {
  if (!deliveredAt) return false
  const deltaSeconds = (occurredAt.getTime() - deliveredAt.getTime()) / 1000
  // Delta negativo (evento "antes" da entrega registrada) só acontece com
  // relógio de máquina/artefato de pipeline — nunca com leitura humana.
  return deltaSeconds < PREFETCH_DELIVERY_DELTA_MAX_SECONDS
}

export function classifyEmailEventOrigin(input: ClassifyEmailEventOriginInput): EmailEventOrigin {
  const userAgent = input.userAgent?.trim() || null

  const botSourceFromUa = userAgent ? matchBotUserAgent(userAgent) : null
  if (botSourceFromUa) {
    return {
      classification: "bot",
      botSource: botSourceFromUa,
      uaFamily: deriveUaFamily(userAgent, botSourceFromUa),
    }
  }

  if (isIpv4InAnyCidr(input.ipAddress, GOOGLE_PROXY_IPV4_CIDRS)) {
    return {
      classification: "bot",
      botSource: "gmail-proxy",
      uaFamily: deriveUaFamily(userAgent, null),
    }
  }
  if (isIpv4InAnyCidr(input.ipAddress, APPLE_MPP_IPV4_CIDRS)) {
    return {
      classification: "bot",
      botSource: "apple-mpp",
      uaFamily: deriveUaFamily(userAgent, null),
    }
  }

  if (isWithinPrefetchWindow(input.occurredAt, input.deliveredAt)) {
    return {
      classification: "bot",
      botSource: "generic",
      uaFamily: deriveUaFamily(userAgent, null),
    }
  }

  if (userAgent) {
    return { classification: "human", uaFamily: deriveUaFamily(userAgent, null) }
  }

  return { classification: "unknown" }
}

/**
 * Reaplica a regra 3 (delta entrega→evento) sobre uma classificação já
 * computada SEM conhecer a entrega.
 *
 * É o caso do evento órfão: quando o open/clique chega antes do `EmailLog`, o
 * classificador roda no webhook com `deliveredAt` desconhecido e a janela de
 * pré-fetch não pôde ser avaliada. No dreno, com o log em mãos, o delta
 * finalmente existe — e evento a menos de
 * `PREFETCH_DELIVERY_DELTA_MAX_SECONDS` da entrega é pré-fetch, não leitura.
 *
 * Só rebaixa: origem já classificada como `bot` fica como está (a evidência de
 * UA/IP é mais específica que a de tempo).
 */
export function reinforceOriginWithDeliveryDelta(
  origin: EmailEventOrigin,
  input: { occurredAt: Date; deliveredAt?: Date | null }
): EmailEventOrigin {
  if (origin.classification === "bot") return origin
  if (!isWithinPrefetchWindow(input.occurredAt, input.deliveredAt)) return origin
  return {
    classification: "bot",
    botSource: "generic",
    ...(origin.uaFamily ? { uaFamily: origin.uaFamily } : {}),
  }
}

/**
 * Extrai a classificação persistida de um `EmailEvent.metadata` (ou do
 * metadata que trafega nas filas). Devolve null quando o evento nunca passou
 * pelo classificador (histórico pré-classificador sem backfill, clique
 * first-party etc.).
 */
export function readEmailEventOrigin(
  metadata: Record<string, unknown> | null | undefined
): EmailEventOrigin | null {
  const origin = metadata?.origin
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) return null
  const classification = (origin as Record<string, unknown>).classification
  if (classification !== "human" && classification !== "bot" && classification !== "unknown") {
    return null
  }
  const botSource = (origin as Record<string, unknown>).botSource
  const uaFamily = (origin as Record<string, unknown>).uaFamily
  return {
    classification,
    ...(typeof botSource === "string" ? { botSource: botSource as EmailEventOriginBotSource } : {}),
    ...(typeof uaFamily === "string" ? { uaFamily } : {}),
  }
}
