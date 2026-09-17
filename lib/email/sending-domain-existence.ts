import { promises as nodeDns } from "node:dns"
import { getDomain } from "tldts"

/**
 * Existência do domínio de envio ANTES de criá-lo no provedor.
 *
 * Motivação (incidente Gorrilhas, 01/09): operador conecta um domínio e a tela
 * só revela o problema dias depois, como "Falhou" na verificação de DNS. O caso
 * mais barato de barrar é digitação de domínio inexistente/não registrado — a
 * resposta certa é um erro imediato no submit, não um `failed` assíncrono.
 *
 * Duas camadas, na ordem do custo:
 * 1. **DNS (NS/SOA)** — se o nome resolve, o domínio existe; encerra sem HTTP.
 * 2. **RDAP (registro)** — só quando o DNS devolve NXDOMAIN, e em **uma única
 *    consulta**: RDAP só cataloga domínios registráveis, então o alvo é o
 *    eTLD+1 do nome digitado (`tldts.getDomain`, Public Suffix List real).
 *    Um subdomínio recém-planejado (`envio.empresa.com.br`) dá NXDOMAIN sem
 *    estar errado — a consulta ao apex registrável decide por ele. Sufixo
 *    público (`com.br` responde **200** no RDAP) nunca é consultado: sem a
 *    PSL, a caminhada por rótulos validava qualquer `.com.br` inexistente
 *    (achado da revisão do PR #1117).
 *
 * Falha de rede/timeout em qualquer camada = `unknown`, e quem chama segue em
 * frente (fail-open): indisponibilidade de resolver não pode bloquear conexão
 * de domínio legítimo. O fallback RDAP é 1 request com deadline próprio — não
 * existe soma de timeouts por candidato.
 */

export type SendingDomainExistence = "exists" | "not_registered" | "unknown"

export type SendingDomainExistenceDeps = {
  resolveNs: (name: string) => Promise<string[]>
  resolveSoa: (name: string) => Promise<unknown>
  /** Devolve o status HTTP do RDAP (200 = registrado, 404 = não registrado). */
  fetchRdapStatus: (name: string) => Promise<number>
}

const RDAP_TIMEOUT_MS = 4000

/** Códigos do resolver que significam "o nome não existe" (e não "resolver fora do ar"). */
const NAME_NOT_FOUND_CODES = new Set(["ENOTFOUND", "NXDOMAIN", "ENODATA"])

function isNameNotFound(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return typeof code === "string" && NAME_NOT_FOUND_CODES.has(code)
}

async function defaultFetchRdapStatus(name: string): Promise<number> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS)
  try {
    // rdap.org redireciona para o RDAP da autoridade do TLD (registro.br etc.).
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(name)}`, {
      redirect: "follow",
      signal: controller.signal,
    })
    return response.status
  } finally {
    clearTimeout(timer)
  }
}

export const defaultSendingDomainExistenceDeps: SendingDomainExistenceDeps = {
  resolveNs: (name) => nodeDns.resolveNs(name),
  resolveSoa: (name) => nodeDns.resolveSoa(name),
  fetchRdapStatus: defaultFetchRdapStatus,
}

async function existsInDns(
  name: string,
  deps: SendingDomainExistenceDeps
): Promise<"exists" | "nxdomain" | "unknown"> {
  try {
    const ns = await deps.resolveNs(name)
    if (ns.length > 0) return "exists"
  } catch (error) {
    if (!isNameNotFound(error)) return "unknown"
  }
  try {
    await deps.resolveSoa(name)
    return "exists"
  } catch (error) {
    return isNameNotFound(error) ? "nxdomain" : "unknown"
  }
}

export async function checkSendingDomainExistence(
  domainName: string,
  deps: SendingDomainExistenceDeps = defaultSendingDomainExistenceDeps
): Promise<SendingDomainExistence> {
  const dnsResult = await existsInDns(domainName, deps)
  if (dnsResult === "exists") return "exists"
  if (dnsResult === "unknown") return "unknown"

  // eTLD+1 via PSL. `null` = o nome digitado é um sufixo público puro ou não
  // tem TLD reconhecível — nenhum dos dois é um domínio de envio conectável.
  const registrableDomain = getDomain(domainName)
  if (!registrableDomain) return "not_registered"

  try {
    const status = await deps.fetchRdapStatus(registrableDomain)
    if (status === 200) return "exists"
    if (status === 404) return "not_registered"
    return "unknown"
  } catch {
    return "unknown"
  }
}
