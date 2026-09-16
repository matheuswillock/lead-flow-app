import { describe, expect, it } from "bun:test"
import {
  CLOUDFLARE_DNS_PROVIDER_NAME,
  identifyDnsProvider,
  type DnsProviderMatch,
} from "./dns-provider-map"

describe("identifyDnsProvider", () => {
  const cases: Array<{ provider: string; nameservers: string[] }> = [
    { provider: "HostGator", nameservers: ["ns1158.hostgator.com.br", "ns1159.hostgator.com.br"] },
    { provider: "Hostinger", nameservers: ["ns1.dns-parking.com", "ns1.hostinger.com"] },
    { provider: "Cloudflare", nameservers: ["gina.ns.cloudflare.com", "rick.ns.cloudflare.com"] },
    { provider: "Registro.br", nameservers: ["a.auto.dns.br", "ns1.registro.br"] },
    { provider: "GoDaddy", nameservers: ["ns23.domaincontrol.com", "ns24.domaincontrol.com"] },
    { provider: "Locaweb", nameservers: ["ns1.locaweb.com.br", "ns2.locaweb.com.br"] },
    { provider: "KingHost", nameservers: ["ns1.kinghost.net", "ns2.kinghost.net"] },
    { provider: "UOL Host", nameservers: ["ns1.uolhost.com.br"] },
    { provider: "UOL Host", nameservers: ["ns1.universo.online"] },
    { provider: "AWS Route 53", nameservers: ["ns-1234.awsdns-12.org", "ns-56.awsdns-07.co.uk"] },
    { provider: "Google", nameservers: ["ns-cloud-a1.googledomains.com"] },
  ]

  for (const { provider, nameservers } of cases) {
    it(`reconhece ${provider} pelos nameservers`, () => {
      expect(identifyDnsProvider(nameservers)).toEqual({ name: provider, nameservers })
    })
  }

  it("devolve name null com os nameservers crus quando nenhum sufixo casa", () => {
    const nameservers = ["ns1.provedor-desconhecido.example", "ns2.provedor-desconhecido.example"]
    const match: DnsProviderMatch = identifyDnsProvider(nameservers)
    expect(match.name).toBeNull()
    expect(match.nameservers).toEqual(nameservers)
  })

  it("é case-insensitive e ignora o ponto final do FQDN", () => {
    expect(identifyDnsProvider(["NS1158.HostGator.COM.BR."]).name).toBe("HostGator")
    expect(identifyDnsProvider(["Gina.NS.Cloudflare.com."]).name).toBe(CLOUDFLARE_DNS_PROVIDER_NAME)
  })

  it("normaliza os nameservers devolvidos (minúsculo, sem ponto final, sem vazios)", () => {
    expect(identifyDnsProvider(["  NS1.Locaweb.com.br.  ", "", "   "])).toEqual({
      name: "Locaweb",
      nameservers: ["ns1.locaweb.com.br"],
    })
  })

  it("não casa sufixo parcial que apenas termina com o texto do provedor", () => {
    expect(identifyDnsProvider(["ns1.naoehostgator.com.br"]).name).toBeNull()
    expect(identifyDnsProvider(["ns1.fakecloudflare.com"]).name).toBeNull()
  })

  it("devolve name null para lista vazia", () => {
    expect(identifyDnsProvider([])).toEqual({ name: null, nameservers: [] })
  })

  it("usa o primeiro nameserver reconhecido quando a lista mistura provedores", () => {
    expect(
      identifyDnsProvider(["ns1.provedor-desconhecido.example", "ns2.kinghost.net"]).name
    ).toBe("KingHost")
  })
})
