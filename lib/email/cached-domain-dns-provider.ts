import { cacheLife, cacheTag } from "next/cache"
import { cacheTags } from "@/lib/cache/cacheTags"
import { lookupDomainDnsProvider } from "@/lib/email/lookup-domain-dns-provider"
import type { DnsProviderMatch } from "@/lib/email/dns-provider-map"

/**
 * Nameserver de domínio muda em troca de hospedagem — evento raro, medido em
 * anos. Seis horas é folgado para um campo de diagnóstico e derruba a consulta
 * DoH para perto de zero por render.
 */
const DNS_PROVIDER_LIFE = { stale: 21_600, revalidate: 21_600, expire: 86_400 }

/**
 * Vida curta na falha, pelo mesmo motivo de `getCachedLandingStats`: gravar
 * "não sei" por seis horas transformaria um timeout de resolver num campo vazio
 * que só volta no próximo deploy. Cinco minutos faz a tela se recuperar sozinha.
 */
const DNS_PROVIDER_UNAVAILABLE_LIFE = { stale: 300, revalidate: 300, expire: 900 }

/**
 * Versão cacheada de `lookupDomainDnsProvider`, consumida pelos UseCases de
 * domínio personalizado. O módulo é separado do lookup de propósito: o lookup
 * fica testável sem `mock.module("next/cache")`, que congela o namespace do
 * módulo para todos os arquivos da mesma execução de `bun test`.
 */
export async function getCachedDomainDnsProvider(
  domainName: string
): Promise<DnsProviderMatch | null> {
  "use cache"
  cacheTag(cacheTags.domainDnsProvider(domainName))

  const match = await lookupDomainDnsProvider(domainName)
  cacheLife(match ? DNS_PROVIDER_LIFE : DNS_PROVIDER_UNAVAILABLE_LIFE)
  return match
}
