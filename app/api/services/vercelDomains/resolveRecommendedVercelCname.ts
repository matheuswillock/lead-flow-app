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
