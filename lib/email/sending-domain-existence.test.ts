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

  /**
   * Achado da revisão do PR #1117: `rdap.org/domain/com.br` responde 200, não
   * 404 — consultar o sufixo público validava qualquer `.com.br` inexistente.
   * O RDAP só é consultado no eTLD+1; o mock devolve 200 para o sufixo de
   * propósito, e isso NÃO pode contar como existência do apex digitado.
   */
  it("apex .com.br com RDAP 404 é not_registered — sufixo público (200) nunca é consultado", async () => {
    const consulted: string[] = []
    const deps = buildDeps({
      fetchRdapStatus: mock(async (name: string) => {
        consulted.push(name)
        return name === "com.br" ? 200 : 404
      }),
    })

    expect(await checkSendingDomainExistence("naoexiste-xyz.com.br", deps)).toBe("not_registered")
    expect(consulted).toEqual(["naoexiste-xyz.com.br"])
  })

  it("subdomínio sem DNS resolve pela consulta única ao apex registrável (eTLD+1)", async () => {
    const consulted: string[] = []
    const deps = buildDeps({
      fetchRdapStatus: mock(async (name: string) => {
        consulted.push(name)
        return name === "empresa.com.br" ? 200 : 404
      }),
    })

    expect(await checkSendingDomainExistence("envio.empresa.com.br", deps)).toBe("exists")
    expect(consulted).toEqual(["empresa.com.br"])
  })

  it("nome que É sufixo público puro (sem eTLD+1) é not_registered sem consultar RDAP", async () => {
    const fetchRdapStatus = mock(async () => 200)
    const deps = buildDeps({ fetchRdapStatus })

    expect(await checkSendingDomainExistence("com.br", deps)).toBe("not_registered")
    expect(fetchRdapStatus).not.toHaveBeenCalled()
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

  it("RDAP indisponível (erro/5xx) é unknown imediato — uma consulta, sem soma de timeouts", async () => {
    const failingFetch = mock(async () => {
      throw new Error("network")
    })
    const porErro = buildDeps({ fetchRdapStatus: failingFetch })
    const por5xx = buildDeps({ fetchRdapStatus: mock(async () => 503) })

    expect(await checkSendingDomainExistence("envio.empresa.com.br", porErro)).toBe("unknown")
    expect(failingFetch).toHaveBeenCalledTimes(1)
    expect(await checkSendingDomainExistence("empresa.com.br", por5xx)).toBe("unknown")
  })
})
