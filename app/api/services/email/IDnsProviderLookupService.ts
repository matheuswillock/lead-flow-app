import type { DnsProviderMatch } from "@/lib/email/dns-provider-map"

export interface IDnsProviderLookupService {
  /**
   * Hospedagem de DNS do domínio, resolvida a partir dos nameservers.
   *
   * Contrato total: NUNCA lança. Falha de resolver, de rede ou de cache vira
   * `null`, e `name: null` com os nameservers preenchidos significa "resolvi os
   * NS, mas nenhum provedor conhecido casa". Hospedagem é dado de diagnóstico —
   * a ausência dela não pode derrubar quem está lendo os registros DNS.
   */
  lookupDnsProvider(domainName: string): Promise<DnsProviderMatch | null>
}
