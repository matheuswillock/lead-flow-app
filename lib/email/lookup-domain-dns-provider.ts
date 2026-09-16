import { getDomain } from "tldts"
import { identifyDnsProvider, type DnsProviderMatch } from "./dns-provider-map"

/**
 * Resolve os nameservers do domínio por **DNS-over-HTTPS** e traduz para o nome
 * da hospedagem (ver `dns-provider-map.ts`).
 *
 * DoH e não `node:dns` de propósito: a consulta roda dentro de uma função da
 * Vercel, onde socket UDP para a porta 53 não é garantido. `fetch` sobre HTTPS
 * é o único transporte confiável ali — e é o mesmo motivo pelo qual o fallback
 * é outro resolver DoH, não um resolver do sistema.
 *
 * **Falha é silenciosa por contrato**: timeout, HTTP 5xx ou JSON inesperado
 * devolvem `null`, e quem chama segue sem o campo. Diagnóstico de suporte não
 * pode derrubar a tela de configuração de e-mail.
 *
 * Dois nomes são consultados em paralelo porque o domínio de envio costuma ser
 * um subdomínio (`mail.empresa.com.br`), que normalmente não tem NS próprio —
 * a delegação vive no apex registrável. Quando o subdomínio É delegado à parte,
 * a resposta dele ganha, por ser a mais específica.
 */

export type DohJsonFetcher = (url: string) => Promise<unknown>

export type LookupDomainDnsProviderDeps = {
  fetchDohJson: DohJsonFetcher
}

/** Código do tipo de registro NS no wire format do DNS (RFC 1035). */
const DNS_RECORD_TYPE_NS = 2

/** RCODEs do DNS (RFC 1035 §4.1.1) que o DoH JSON devolve no campo `Status`. */
const DNS_STATUS_NOERROR = 0
const DNS_STATUS_NXDOMAIN = 3

/**
 * Curto de propósito: o campo é informativo e os dois resolvers respondem em
 * dezenas de milissegundos. No pior caso (primário mudo, secundário mudo) o
 * teto é 2 × este valor por nome, com os nomes em paralelo.
 */
const DOH_REQUEST_TIMEOUT_MS = 1500

const DOH_ENDPOINTS: Array<(domainName: string) => string> = [
  (domainName) => `https://dns.google/resolve?name=${encodeURIComponent(domainName)}&type=NS`,
  (domainName) =>
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domainName)}&type=NS`,
]

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

export const defaultLookupDomainDnsProviderDeps: LookupDomainDnsProviderDeps = {
  fetchDohJson: fetchDohJsonOverHttps,
}

type DohAnswer = { type?: unknown; data?: unknown }

/**
 * `null` = resposta inutilizável (tentar o próximo RESOLVER).
 * `[]` = resolver respondeu de forma autoritativa e o nome não tem NS (tentar o
 * próximo NOME — um segundo resolver devolveria o mesmo vazio).
 *
 * A distinção importa porque SERVFAIL e REFUSED chegam com **HTTP 200**: sem
 * separá-los do NOERROR/NXDOMAIN, o `catch` nunca dispara, o fallback nunca é
 * consultado e o campo fica vazio com um resolver perfeitamente saudável do
 * outro lado (achado do cursor no PR #1182).
 */
function parseNameserversFromDohJson(payload: unknown): string[] | null {
  if (!payload || typeof payload !== "object") return null

  const { Status: status, Answer: answer } = payload as { Status?: unknown; Answer?: unknown }
  if (typeof status !== "number") return null

  if (status === DNS_STATUS_NOERROR) {
    if (!Array.isArray(answer)) return []
    return (answer as DohAnswer[])
      .filter((record) => record.type === DNS_RECORD_TYPE_NS && typeof record.data === "string")
      .map((record) => record.data as string)
  }

  // NXDOMAIN é veredito autoritativo sobre o nome; qualquer outro RCODE é falha
  // do resolver, e falha de resolver é exatamente o que o fallback existe para cobrir.
  return status === DNS_STATUS_NXDOMAIN ? [] : null
}

async function resolveNameservers(
  domainName: string,
  deps: LookupDomainDnsProviderDeps
): Promise<string[] | null> {
  for (const buildUrl of DOH_ENDPOINTS) {
    try {
      const nameservers = parseNameserversFromDohJson(await deps.fetchDohJson(buildUrl(domainName)))
      if (nameservers) return nameservers
    } catch {
      // Resolver fora do ar ou lento: cai para o próximo sem interromper o fluxo.
    }
  }
  return null
}

/** Nameserver e domínio chegam como FQDN (`Mail.Empresa.COM.BR.`) em parte das fontes. */
function normalizeDomainName(domainName: string): string {
  return domainName.trim().toLowerCase().replace(/\.+$/, "")
}

/**
 * Zonas candidatas, da mais específica ao apex registrável.
 *
 * Não basta `[nome, apex]`: `mail.marketing.empresa.com.br` pode ter a
 * delegação em `marketing.empresa.com.br`, e pular esse degrau nomearia a
 * hospedagem do apex — provedor errado no card e nas instruções copiadas
 * (achado do codex no PR #1182). O teto de 4 nomes cobre apex + 3 níveis, que
 * é mais fundo do que qualquer domínio de envio real; abaixo disso a consulta
 * começa no degrau mais próximo do apex que couber.
 */
const MAX_CANDIDATE_ZONES = 4

function buildCandidateZones(domainName: string): string[] {
  const registrableDomain = getDomain(domainName)
  if (!registrableDomain || registrableDomain === domainName) return [domainName]

  const labels = domainName.split(".")
  const apexLabelCount = registrableDomain.split(".").length
  const candidates: string[] = []
  for (let start = 0; labels.length - start >= apexLabelCount; start += 1) {
    candidates.push(labels.slice(start).join("."))
  }
  return candidates.slice(-MAX_CANDIDATE_ZONES)
}

export async function lookupDomainDnsProvider(
  domainName: string,
  deps: LookupDomainDnsProviderDeps = defaultLookupDomainDnsProviderDeps
): Promise<DnsProviderMatch | null> {
  const normalized = normalizeDomainName(domainName)
  if (!normalized) return null

  const candidates = buildCandidateZones(normalized)

  const resolved = await Promise.all(
    candidates.map((candidate) => resolveNameservers(candidate, deps))
  )

  // Ordem de `candidates`: a zona mais específica com NS ganha das ancestrais.
  const nameservers = resolved.find((result) => result !== null && result.length > 0)
  if (!nameservers) {
    console.warn(`[lookupDomainDnsProvider] sem nameservers utilizáveis para ${normalized}`)
    return null
  }

  return identifyDnsProvider(nameservers)
}
