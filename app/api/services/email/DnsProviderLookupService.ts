import { resolveDomainDnsProviderSafely } from "@/lib/email/cached-domain-dns-provider"
import type { DnsProviderMatch } from "@/lib/email/dns-provider-map"
import type { IDnsProviderLookupService } from "./IDnsProviderLookupService"

/**
 * Porta de saída da resolução de hospedagem de DNS. O `lib/email` abaixo faz o
 * trabalho técnico — consulta DoH, cache e tradução dos nameservers para o nome
 * amigável; o Service existe para que os UseCases dependam da interface, nunca
 * da função concreta.
 *
 * O resolver entra pelo construtor pela mesma razão que o `resendFactory` do
 * `EmailTeamSettingsUseCase`: sem essa costura, testar o Service exigiria
 * `mock.module` em `next/cache`, que congela o namespace do módulo para todos
 * os arquivos da mesma execução de `bun test`.
 */
export type DomainDnsProviderResolver = (domainName: string) => Promise<DnsProviderMatch | null>

export class DnsProviderLookupService implements IDnsProviderLookupService {
  constructor(
    private readonly resolveDnsProvider: DomainDnsProviderResolver = resolveDomainDnsProviderSafely
  ) {}

  async lookupDnsProvider(domainName: string): Promise<DnsProviderMatch | null> {
    return this.resolveDnsProvider(domainName)
  }
}
