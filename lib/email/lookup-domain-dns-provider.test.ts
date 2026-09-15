import { describe, expect, it } from "bun:test"
import {
  lookupDomainDnsProvider,
  type LookupDomainDnsProviderDeps,
} from "./lookup-domain-dns-provider"

const NS_RECORD_TYPE = 2

function dohAnswer(nameservers: string[]) {
  return {
    Status: 0,
    Answer: nameservers.map((data) => ({ name: "irrelevante.", type: NS_RECORD_TYPE, TTL: 3600, data })),
  }
}

const EMPTY_DOH_ANSWER = { Status: 0 }

/** Registra as URLs consultadas e responde conforme o nome pedido. */
function depsRespondingWith(
  responseByDomainName: Record<string, unknown>,
  requestedUrls: string[] = []
): LookupDomainDnsProviderDeps {
  return {
    fetchDohJson: async (url) => {
      requestedUrls.push(url)
      const name = new URL(url).searchParams.get("name") ?? ""
      const response = responseByDomainName[name]
      if (response === undefined) throw new Error(`sem resposta configurada para ${name}`)
      return response
    },
  }
}

describe("lookupDomainDnsProvider", () => {
  it("identifica o provedor pelos NS do próprio nome consultado", async () => {
    const match = await lookupDomainDnsProvider(
      "empresa.com.br",
      depsRespondingWith({
        "empresa.com.br": dohAnswer(["ns1158.hostgator.com.br.", "ns1159.hostgator.com.br."]),
      })
    )

    expect(match).toEqual({
      name: "HostGator",
      nameservers: ["ns1158.hostgator.com.br", "ns1159.hostgator.com.br"],
    })
  })

  it("cai para o apex registrável quando o subdomínio de envio não tem NS próprio", async () => {
    const match = await lookupDomainDnsProvider(
      "mail.empresa.com.br",
      depsRespondingWith({
        "mail.empresa.com.br": EMPTY_DOH_ANSWER,
        "empresa.com.br": dohAnswer(["gina.ns.cloudflare.com."]),
      })
    )

    expect(match?.name).toBe("Cloudflare")
  })

  it("prefere a delegação do subdomínio quando ela existe", async () => {
    const match = await lookupDomainDnsProvider(
      "mail.empresa.com.br",
      depsRespondingWith({
        "mail.empresa.com.br": dohAnswer(["ns1.kinghost.net."]),
        "empresa.com.br": dohAnswer(["ns23.domaincontrol.com."]),
      })
    )

    expect(match?.name).toBe("KingHost")
  })

  it("consulta o resolver primário antes do fallback e só usa o fallback na falha", async () => {
    const requestedUrls: string[] = []
    const deps: LookupDomainDnsProviderDeps = {
      fetchDohJson: async (url) => {
        requestedUrls.push(url)
        if (url.startsWith("https://dns.google/")) throw new Error("primário indisponível")
        return dohAnswer(["ns1.locaweb.com.br."])
      },
    }

    const match = await lookupDomainDnsProvider("empresa.com.br", deps)

    expect(match?.name).toBe("Locaweb")
    expect(requestedUrls[0]).toContain("https://dns.google/resolve?name=empresa.com.br&type=NS")
    expect(requestedUrls[1]).toContain(
      "https://cloudflare-dns.com/dns-query?name=empresa.com.br&type=NS"
    )
  })

  it("devolve null sem lançar quando todos os resolvers falham", async () => {
    const match = await lookupDomainDnsProvider("empresa.com.br", {
      fetchDohJson: async () => {
        throw new Error("timeout")
      },
    })

    expect(match).toBeNull()
  })

  it("devolve null quando a resposta do resolver não tem o formato esperado", async () => {
    const match = await lookupDomainDnsProvider(
      "empresa.com.br",
      depsRespondingWith({ "empresa.com.br": { unexpected: true } })
    )

    expect(match).toBeNull()
  })

  it("devolve null quando o DNS responde NXDOMAIN em todos os nomes", async () => {
    const match = await lookupDomainDnsProvider(
      "mail.inexistente.com.br",
      depsRespondingWith({
        "mail.inexistente.com.br": { Status: 3 },
        "inexistente.com.br": { Status: 3 },
      })
    )

    expect(match).toBeNull()
  })

  it("ignora respostas que não são NS", async () => {
    const match = await lookupDomainDnsProvider(
      "empresa.com.br",
      depsRespondingWith({
        "empresa.com.br": {
          Status: 0,
          Answer: [{ name: "empresa.com.br.", type: 1, TTL: 60, data: "203.0.113.10" }],
        },
      })
    )

    expect(match).toBeNull()
  })

  it("devolve name null com os NS crus quando o provedor não está no mapa", async () => {
    const match = await lookupDomainDnsProvider(
      "empresa.com.br",
      depsRespondingWith({
        "empresa.com.br": dohAnswer(["ns1.provedor-local.example.", "ns2.provedor-local.example."]),
      })
    )

    expect(match).toEqual({
      name: null,
      nameservers: ["ns1.provedor-local.example", "ns2.provedor-local.example"],
    })
  })

  it("devolve null para nome vazio sem consultar resolver nenhum", async () => {
    const requestedUrls: string[] = []
    const match = await lookupDomainDnsProvider("   ", depsRespondingWith({}, requestedUrls))

    expect(match).toBeNull()
    expect(requestedUrls).toHaveLength(0)
  })
})
