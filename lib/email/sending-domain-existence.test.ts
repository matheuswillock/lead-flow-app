import { describe, expect, it, mock } from "bun:test"
import {
  checkSendingDomainExistence,
  type SendingDomainExistenceDeps,
} from "./sending-domain-existence"

function nxdomain(): never {
  const error = new Error("queryNs ENOTFOUND") as Error & { code: string }
  error.code = "ENOTFOUND"
  throw error
}

function resolverDown(): never {
  const error = new Error("queryNs ETIMEOUT") as Error & { code: string }
  error.code = "ETIMEOUT"
  throw error
}

function buildDeps(overrides: Partial<SendingDomainExistenceDeps>): SendingDomainExistenceDeps {
  return {
    resolveNs: mock(async () => nxdomain()),
    resolveSoa: mock(async () => nxdomain()),
    fetchRdapStatus: mock(async () => 404),
    ...overrides,
  }
}

describe("checkSendingDomainExistence", () => {
  it("NS resolvendo encerra como exists sem chamar RDAP", async () => {
    const fetchRdapStatus = mock(async () => 404)
    const deps = buildDeps({ resolveNs: mock(async () => ["a.dns.br"]), fetchRdapStatus })

    expect(await checkSendingDomainExistence("empresa.com.br", deps)).toBe("exists")
    expect(fetchRdapStatus).not.toHaveBeenCalled()
  })

  it("NXDOMAIN no NS mas SOA vivo (zona vazia, caso Gorrilhas) é exists", async () => {
    const deps = buildDeps({ resolveSoa: mock(async () => ({ nsname: "a.auto.dns.br" })) })

    expect(await checkSendingDomainExistence("gorrilhaseguros.com.br", deps)).toBe("exists")
  })

  it("NXDOMAIN + RDAP 404 em toda a cadeia é not_registered", async () => {
    const consulted: string[] = []
    const deps = buildDeps({
      fetchRdapStatus: mock(async (name: string) => {
        consulted.push(name)
        return 404
      }),
    })

    expect(await checkSendingDomainExistence("naoexiste-xyz.com.br", deps)).toBe("not_registered")
    expect(consulted).toEqual(["naoexiste-xyz.com.br", "com.br"])
  })

  it("subdomínio sem DNS de domínio registrado é exists (RDAP acha o apex)", async () => {
    const deps = buildDeps({
      fetchRdapStatus: mock(async (name: string) => (name === "empresa.com.br" ? 200 : 404)),
    })

    expect(await checkSendingDomainExistence("envio.empresa.com.br", deps)).toBe("exists")
  })

  it("resolver fora do ar é unknown (fail-open), sem consultar RDAP", async () => {
    const fetchRdapStatus = mock(async () => 404)
    const deps = buildDeps({
      resolveNs: mock(async () => resolverDown()),
      resolveSoa: mock(async () => resolverDown()),
      fetchRdapStatus,
    })

    expect(await checkSendingDomainExistence("empresa.com.br", deps)).toBe("unknown")
    expect(fetchRdapStatus).not.toHaveBeenCalled()
  })

  it("RDAP indisponível (erro/5xx) é unknown, nunca not_registered", async () => {
    const porErro = buildDeps({
      fetchRdapStatus: mock(async () => {
        throw new Error("network")
      }),
    })
    const por5xx = buildDeps({ fetchRdapStatus: mock(async () => 503) })

    expect(await checkSendingDomainExistence("empresa.com.br", porErro)).toBe("unknown")
    expect(await checkSendingDomainExistence("empresa.com.br", por5xx)).toBe("unknown")
  })
})
