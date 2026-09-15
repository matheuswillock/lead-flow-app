import { describe, expect, it, mock } from "bun:test"
import { DnsProviderLookupService } from "./DnsProviderLookupService"
import type { IDnsProviderLookupService } from "./IDnsProviderLookupService"
import type { DnsProviderMatch } from "@/lib/email/dns-provider-map"

const HOSTGATOR: DnsProviderMatch = {
  name: "HostGator",
  nameservers: ["ns1158.hostgator.com.br", "ns1159.hostgator.com.br"],
}

describe("DnsProviderLookupService", () => {
  it("devolve a hospedagem resolvida para o domínio pedido", async () => {
    const resolve = mock(async (_domainName: string) => HOSTGATOR)
    const service = new DnsProviderLookupService(resolve)

    expect(await service.lookupDnsProvider("mail.empresa.com.br")).toEqual(HOSTGATOR)
    expect(resolve).toHaveBeenCalledWith("mail.empresa.com.br")
  })

  it("propaga null quando a resolução não identifica nada", async () => {
    const service = new DnsProviderLookupService(async () => null)

    expect(await service.lookupDnsProvider("mail.empresa.com.br")).toBeNull()
  })

  /**
   * LSP: quem consome depende só da interface, então a implementação concreta
   * precisa ser substituível por qualquer outra sem o consumidor checar o tipo.
   */
  it("é substituível pela interface", async () => {
    const service: IDnsProviderLookupService = new DnsProviderLookupService(async () => HOSTGATOR)

    expect(await service.lookupDnsProvider("empresa.com.br")).toEqual(HOSTGATOR)
  })
})
