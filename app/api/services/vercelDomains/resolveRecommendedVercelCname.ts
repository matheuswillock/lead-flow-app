<<<<<<< HEAD
import type {
  IVercelDomainsGateway,
  VercelDomainConfig,
} from "./IVercelDomainsGateway"

export function selectRecommendedVercelCname(config?: VercelDomainConfig | null): string | null {
  const recommendation = [...(config?.recommendedCNAME ?? [])]
    .filter((candidate) => candidate.value.trim().length > 0)
    .sort((left, right) => left.rank - right.rank)[0]

  return recommendation?.value ?? null
}

export async function resolveRecommendedVercelCname(
  gateway: IVercelDomainsGateway,
  hostname: string,
): Promise<string | null> {
  const config = await gateway.getDomainConfig(hostname)
  return config.ok ? selectRecommendedVercelCname(config.data) : null
}
=======
/** Mapa de domínios Vercel para geração de CNAME recomendado. */
const vercelCnameMap: Record<string, string> = {
  // Padrões comuns de domínios Vercel
  forms: "*.vercel.com",
  app: "*.vercel.com",
  web: "*.vercel.com",
  default: "*.vercel.com",
}

/** Seleciona o CNAME recomendado com base nos dados da configuração de domínio da Vercel.
 * 
 * O campo `recommendedCNAME` pode ser:
 * - Um string direto
 * - Um array de { rank: number; value: string } ordenado por rank (menor = mais preferencial)
 * - Um objeto com propriedade `cname`
 */
export function selectRecommendedVercelCname(domainConfig: Record<string, unknown>): string | null {
  // Priority 1: array de CNAMEs Rankeados (menor rank = mais preferencial)
  const recommendedCNAMEs = domainConfig?.recommendedCNAME
  if (Array.isArray(recommendedCNAMEs) && recommendedCNAMEs.length > 0) {
    // Ordena por rank (ascendente) e pega o de menor rank (mais preferencial)
    const sorted = [...recommendedCNAMEs].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    const preferred = sorted[0]?.value?.toString()
    if (preferred && preferred.trim()) {
      return preferred
    }
  }

  // Priority 2: CNAME explícita como string
  const explicitCNAME = domainConfig?.recommendedCNAME?.toString()
  if (explicitCNAME && explicitCNAME.trim()) {
    return explicitCNAME
  }

  // Priority 3: objeto com propriedade cname
  const cnameObj = (domainConfig?.recommendedCNAME as Record<string, unknown>)?.cname
  if (cnameObj && typeof cnameObj === "string" && cnameObj.trim()) {
    return cnameObj
  }

  // Priority 4: hostname conhecido mapeado para Vercel
  const hostname = domainConfig?.hostname?.toString()?.toLowerCase() || ""
  if (hostname.includes("forms") || hostname.includes("app")) {
    return "preferred.vercel-dns.com"
  }

  // Priority 5: domínio Vercel genérico
  return "*.vercel.com"
}
>>>>>>> cb8425663 (feat: implementar auditoria DNS Studio/Vercel completa per SPEC)
