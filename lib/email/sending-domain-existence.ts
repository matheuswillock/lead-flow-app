import { promises as nodeDns } from "node:dns"

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
 * 2. **RDAP (registro)** — só quando o DNS devolve NXDOMAIN. Um subdomínio
 *    recém-planejado (`envio.empresa.com.br`) dá NXDOMAIN sem estar errado, por
 *    isso o RDAP caminha do nome digitado até o apex: se QUALQUER nível estiver
 *    registrado, o domínio existe. Sufixo público (`com.br`) responde 404 no
 *    RDAP, então a caminhada não produz falso "existe".
 *
 * Falha de rede/timeout em qualquer camada = `unknown`, e quem chama segue em
 * frente (fail-open): indisponibilidade de resolver não pode bloquear conexão
 * de domínio legítimo.
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

/** `sub.empresa.com.br` → `["sub.empresa.com.br", "empresa.com.br", "com.br"]`. */
function candidateChain(name: string): string[] {
  const labels = name.split(".").filter(Boolean)
  const chain: string[] = []
  for (let start = 0; start <= labels.length - 2; start += 1) {
    chain.push(labels.slice(start).join("."))
  }
  return chain
}

export async function checkSendingDomainExistence(
  domainName: string,
  deps: SendingDomainExistenceDeps = defaultSendingDomainExistenceDeps
): Promise<SendingDomainExistence> {
  const dnsResult = await existsInDns(domainName, deps)
  if (dnsResult === "exists") return "exists"
  if (dnsResult === "unknown") return "unknown"

  let sawUnknown = false
  for (const candidate of candidateChain(domainName)) {
    try {
      const status = await deps.fetchRdapStatus(candidate)
      if (status === 200) return "exists"
      if (status !== 404) sawUnknown = true
    } catch {
      sawUnknown = true
    }
  }
  return sawUnknown ? "unknown" : "not_registered"
}
