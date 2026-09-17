import type { DohJsonFetcher } from "./lookup-domain-dns-provider"

/**
 * Checagem MX/A do domínio do destinatário por **DNS-over-HTTPS** — mesmo
 * transporte e mesmos resolvers de `lookup-domain-dns-provider.ts` (socket UDP
 * para a porta 53 não é garantido dentro de função da Vercel).
 *
 * Semântica dos vereditos:
 * - `deliverable`: o domínio tem MX, ou (fallback do RFC 5321 §5.1) registro A.
 * - `undeliverable`: NXDOMAIN, ou NOERROR sem MX **e** sem A — não existe
 *   servidor capaz de receber e-mail; enviar é bounce garantido.
 * - `unknown`: os resolvers falharam (timeout/5xx/SERVFAIL). **Fail-open por
 *   contrato**: indisponibilidade de resolver não pode recusar contato — o
 *   gate só rejeita com veredito autoritativo.
 */

export type DomainMailDnsVerdict = "deliverable" | "undeliverable" | "unknown"

export type DomainMailDnsDeps = {
  fetchDohJson: DohJsonFetcher
}

/** Códigos de tipo de registro no wire format do DNS (RFC 1035). */
const DNS_RECORD_TYPE_MX = 15
const DNS_RECORD_TYPE_A = 1

/** RCODEs (RFC 1035 §4.1.1) devolvidos no campo `Status` do DoH JSON. */
const DNS_STATUS_NOERROR = 0
const DNS_STATUS_NXDOMAIN = 3

const DOH_REQUEST_TIMEOUT_MS = 1500

const DOH_ENDPOINTS: Array<(domainName: string, recordType: string) => string> = [
  (domainName, recordType) =>
    `https://dns.google/resolve?name=${encodeURIComponent(domainName)}&type=${recordType}`,
  (domainName, recordType) =>
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domainName)}&type=${recordType}`,
]

/**
 * Provedores dominantes no público BR: resolver de novo a cada import seria
 * latência pura — a resposta nunca muda no horizonte de um job.
 */
const WELL_KNOWN_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "uol.com.br",
  "terra.com.br",
  "globo.com",
  "globomail.com",
  "protonmail.com",
  "proton.me",
  "aol.com",
])

async function fetchDohJsonOverHttps(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(DOH_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`DoH respondeu HTTP ${response.status}`)
  }
  return response.json()
}

export const defaultDomainMailDnsDeps: DomainMailDnsDeps = {
  fetchDohJson: fetchDohJsonOverHttps,
}

type DohAnswer = { type?: unknown; data?: unknown }

type RecordQueryResult =
  | { kind: "answered"; count: number }
  | { kind: "nxdomain" }
  | { kind: "resolver_failed" }

/**
 * `null` = resposta inutilizável (tentar o próximo resolver). SERVFAIL e
 * REFUSED chegam com HTTP 200 — sem separá-los de NOERROR/NXDOMAIN o fallback
 * nunca seria consultado (mesmo achado do PR #1182 no lookup de NS).
 */
function parseDohAnswerCount(
  payload: unknown,
  recordTypeCode: number
): { status: "noerror"; count: number } | { status: "nxdomain" } | null {
  if (!payload || typeof payload !== "object") return null

  const { Status: status, Answer: answer } = payload as { Status?: unknown; Answer?: unknown }
  if (typeof status !== "number") return null

  if (status === DNS_STATUS_NOERROR) {
    if (!Array.isArray(answer)) return { status: "noerror", count: 0 }
    const count = (answer as DohAnswer[]).filter(
      (record) => record.type === recordTypeCode && typeof record.data === "string"
    ).length
    return { status: "noerror", count }
  }

  return status === DNS_STATUS_NXDOMAIN ? { status: "nxdomain" } : null
}

async function queryRecord(
  domainName: string,
  recordType: "MX" | "A",
  deps: DomainMailDnsDeps
): Promise<RecordQueryResult> {
  const recordTypeCode = recordType === "MX" ? DNS_RECORD_TYPE_MX : DNS_RECORD_TYPE_A
  for (const buildUrl of DOH_ENDPOINTS) {
    try {
      const parsed = parseDohAnswerCount(
        await deps.fetchDohJson(buildUrl(domainName, recordType)),
        recordTypeCode
      )
      if (!parsed) continue
      if (parsed.status === "nxdomain") return { kind: "nxdomain" }
      return { kind: "answered", count: parsed.count }
    } catch {
      // Resolver fora do ar ou lento: cai para o próximo sem interromper o job.
    }
  }
  return { kind: "resolver_failed" }
}

function normalizeDomainName(domainName: string): string {
  return domainName.trim().toLowerCase().replace(/\.+$/, "")
}

export async function resolveDomainMailDnsVerdict(
  domainName: string,
  deps: DomainMailDnsDeps = defaultDomainMailDnsDeps
): Promise<DomainMailDnsVerdict> {
  const normalized = normalizeDomainName(domainName)
  if (!normalized || !normalized.includes(".")) return "undeliverable"
  if (WELL_KNOWN_MAIL_DOMAINS.has(normalized)) return "deliverable"

  const mx = await queryRecord(normalized, "MX", deps)
  if (mx.kind === "nxdomain") return "undeliverable"
  if (mx.kind === "answered" && mx.count > 0) return "deliverable"
  if (mx.kind === "resolver_failed") return "unknown"

  // NOERROR sem MX: fallback A (RFC 5321 §5.1) antes de condenar o domínio.
  const a = await queryRecord(normalized, "A", deps)
  if (a.kind === "nxdomain") return "undeliverable"
  if (a.kind === "answered") return a.count > 0 ? "deliverable" : "undeliverable"
  return "unknown"
}

/**
 * Cache por domínio para a vida de UM job de importação.
 *
 * - Vereditos autoritativos (`deliverable`/`undeliverable`) são memorizados.
 * - `unknown` NÃO é memorizado: falha de resolver é transitória, e memorizar
 *   o azar de um lote contaminaria os lotes seguintes.
 * - Consultas concorrentes ao mesmo domínio compartilham a promise em voo.
 */
export class DomainMailDnsCache {
  private readonly verdicts = new Map<string, DomainMailDnsVerdict>()
  private readonly inFlight = new Map<string, Promise<DomainMailDnsVerdict>>()

  constructor(private readonly deps: DomainMailDnsDeps = defaultDomainMailDnsDeps) {}

  async resolve(domainName: string): Promise<DomainMailDnsVerdict> {
    const normalized = normalizeDomainName(domainName)
    if (!normalized) return "undeliverable"

    const cached = this.verdicts.get(normalized)
    if (cached) return cached

    const pending = this.inFlight.get(normalized)
    if (pending) return pending

    const lookup = resolveDomainMailDnsVerdict(normalized, this.deps)
      .then((verdict) => {
        if (verdict !== "unknown") this.verdicts.set(normalized, verdict)
        return verdict
      })
      .finally(() => {
        this.inFlight.delete(normalized)
      })

    this.inFlight.set(normalized, lookup)
    return lookup
  }

  /** Quantos domínios têm veredito memorizado — exposto para teste. */
  get size(): number {
    return this.verdicts.size
  }
}
