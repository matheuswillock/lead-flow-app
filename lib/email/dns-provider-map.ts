/**
 * Identificação da hospedagem de DNS a partir dos nameservers do domínio.
 *
 * Motivação (caso Inter Plaza, 15/09): descobrir "o domínio está na HostGator e
 * faltam 3 registros" custou uma investigação inteira com `dig`. O painel do
 * provedor de e-mail mostra isso de graça ("Provider: HostGator") porque os
 * nameservers entregam a resposta — `ns1158.hostgator.com.br` só existe na
 * HostGator. Este módulo é a parte pura dessa leitura: recebe nameservers já
 * resolvidos e devolve o nome amigável. A consulta DNS em si vive em
 * `lookup-domain-dns-provider.ts`.
 *
 * Sem match não há chute: `name` volta `null` e os nameservers crus seguem para
 * a tela, que é o dado de que o suporte precisa para continuar o diagnóstico.
 */

export type DnsProviderMatch = {
  /** Nome amigável do provedor; `null` quando nenhuma regra conhecida casa. */
  name: string | null
  /** Nameservers normalizados (minúsculo, sem ponto final), na ordem recebida. */
  nameservers: string[]
}

export const CLOUDFLARE_DNS_PROVIDER_NAME = "Cloudflare"

type DnsProviderRule = {
  name: string
  matches: (nameserver: string) => boolean
}

/**
 * Casa pelo domínio do nameserver, respeitando a fronteira de rótulo:
 * `ns1.naoehostgator.com.br` não é HostGator só por terminar com o texto.
 */
function matchesDomainSuffix(...suffixes: string[]) {
  return (nameserver: string) =>
    suffixes.some((suffix) => nameserver === suffix || nameserver.endsWith(`.${suffix}`))
}

/**
 * A Route 53 não tem sufixo estável — o mesmo domínio recebe nameservers em
 * `.org`, `.com`, `.net` e `.co.uk`. O que se repete é o rótulo `awsdns-NN`.
 */
function matchesLabelPrefix(prefix: string) {
  return (nameserver: string) =>
    nameserver.split(".").some((label) => label.startsWith(prefix))
}

const DNS_PROVIDER_RULES: DnsProviderRule[] = [
  { name: "HostGator", matches: matchesDomainSuffix("hostgator.com.br", "hostgator.com") },
  // `dns-parking.com` é o nameserver que a Hostinger entrega por padrão.
  { name: "Hostinger", matches: matchesDomainSuffix("hostinger.com", "dns-parking.com") },
  { name: CLOUDFLARE_DNS_PROVIDER_NAME, matches: matchesDomainSuffix("cloudflare.com") },
  // `auto.dns.br` é o nameserver automático do próprio Registro.br.
  { name: "Registro.br", matches: matchesDomainSuffix("registro.br", "dns.br") },
  { name: "GoDaddy", matches: matchesDomainSuffix("domaincontrol.com") },
  { name: "Locaweb", matches: matchesDomainSuffix("locaweb.com.br") },
  { name: "KingHost", matches: matchesDomainSuffix("kinghost.net") },
  { name: "UOL Host", matches: matchesDomainSuffix("uolhost.com.br", "universo.online") },
  { name: "AWS Route 53", matches: matchesLabelPrefix("awsdns") },
  { name: "Google", matches: matchesDomainSuffix("googledomains.com", "google.com") },
]

/** Nameserver chega do DNS como FQDN (`NS1.Locaweb.COM.BR.`); a comparação é sempre normalizada. */
function normalizeNameserver(nameserver: string): string {
  return nameserver.trim().toLowerCase().replace(/\.+$/, "")
}

export function identifyDnsProvider(nameservers: string[]): DnsProviderMatch {
  const normalized = nameservers.map(normalizeNameserver).filter((value) => value.length > 0)

  for (const nameserver of normalized) {
    const rule = DNS_PROVIDER_RULES.find((candidate) => candidate.matches(nameserver))
    if (rule) return { name: rule.name, nameservers: normalized }
  }

  return { name: null, nameservers: normalized }
}
