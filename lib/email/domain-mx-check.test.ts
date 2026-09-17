import { describe, expect, it } from "bun:test"
import {
  DomainMailDnsCache,
  resolveDomainMailDnsVerdict,
  type DomainMailDnsDeps,
} from "./domain-mx-check"

const DNS_TYPE_MX = 15
const DNS_TYPE_A = 1

type DohResponse = { Status: number; Answer?: Array<{ type: number; data: string }> }

/** Fetcher fake: responde por tipo de registro; registra as URLs consultadas. */
function buildDeps(
  byType: Partial<Record<"MX" | "A", DohResponse | Error>>,
  calls: string[] = []
): DomainMailDnsDeps {
  return {
    fetchDohJson: async (url: string) => {
      calls.push(url)
      const recordType = url.includes("type=MX") ? "MX" : "A"
      const response = byType[recordType]
      if (!response) throw new Error(`sem resposta configurada para ${recordType}`)
      if (response instanceof Error) throw response
      return response
    },
  }
}

describe("resolveDomainMailDnsVerdict", () => {
  it("domínio com MX = deliverable, sem consultar A", async () => {
    const calls: string[] = []
    const deps = buildDeps(
      { MX: { Status: 0, Answer: [{ type: DNS_TYPE_MX, data: "10 mx.example.com." }] } },
      calls
    )
    expect(await resolveDomainMailDnsVerdict("example.com", deps)).toBe("deliverable")
    expect(calls.some((url) => url.includes("type=A"))).toBe(false)
  })

  it("NOERROR sem MX mas com A = deliverable (fallback RFC 5321)", async () => {
    const deps = buildDeps({
      MX: { Status: 0, Answer: [] },
      A: { Status: 0, Answer: [{ type: DNS_TYPE_A, data: "203.0.113.10" }] },
    })
    expect(await resolveDomainMailDnsVerdict("example.com", deps)).toBe("deliverable")
  })

  it("NOERROR sem MX e sem A = undeliverable", async () => {
    const deps = buildDeps({
      MX: { Status: 0, Answer: [] },
      A: { Status: 0, Answer: [] },
    })
    expect(await resolveDomainMailDnsVerdict("example.com", deps)).toBe("undeliverable")
  })

  it("NXDOMAIN = undeliverable, sem fallback A", async () => {
    const calls: string[] = []
    const deps = buildDeps({ MX: { Status: 3 } }, calls)
    expect(await resolveDomainMailDnsVerdict("naoexiste.example", deps)).toBe("undeliverable")
    expect(calls.some((url) => url.includes("type=A"))).toBe(false)
  })

  it("os dois resolvers mudos = unknown (fail-open, nunca rejeita)", async () => {
    const deps = buildDeps({ MX: new Error("timeout"), A: new Error("timeout") })
    expect(await resolveDomainMailDnsVerdict("example.com", deps)).toBe("unknown")
  })

  it("SERVFAIL (HTTP 200 com Status≠0/3) cai para o resolver seguinte", async () => {
    const responses: DohResponse[] = [
      { Status: 2 }, // SERVFAIL no primário
      { Status: 0, Answer: [{ type: DNS_TYPE_MX, data: "10 mx.example.com." }] },
    ]
    const deps: DomainMailDnsDeps = {
      fetchDohJson: async () => responses.shift() ?? { Status: 2 },
    }
    expect(await resolveDomainMailDnsVerdict("example.com", deps)).toBe("deliverable")
  })

  it("provedor consagrado (gmail.com) responde sem NENHUM lookup", async () => {
    const calls: string[] = []
    const deps = buildDeps({}, calls)
    expect(await resolveDomainMailDnsVerdict("gmail.com", deps)).toBe("deliverable")
    expect(calls).toHaveLength(0)
  })

  it("string sem ponto = undeliverable direto", async () => {
    const calls: string[] = []
    const deps = buildDeps({}, calls)
    expect(await resolveDomainMailDnsVerdict("localhost", deps)).toBe("undeliverable")
    expect(calls).toHaveLength(0)
  })
})

describe("DomainMailDnsCache — cache por domínio na vida do job", () => {
  it("memoiza veredito autoritativo: segundo resolve não consulta DNS", async () => {
    const calls: string[] = []
    const cache = new DomainMailDnsCache(
      buildDeps({ MX: { Status: 0, Answer: [{ type: DNS_TYPE_MX, data: "10 mx." }] } }, calls)
    )
    await cache.resolve("empresa.com.br")
    await cache.resolve("empresa.com.br")
    expect(calls).toHaveLength(1)
    expect(cache.size).toBe(1)
  })

  it("NÃO memoiza unknown: falha transitória de resolver não contamina lotes seguintes", async () => {
    let failures = 0
    const deps: DomainMailDnsDeps = {
      fetchDohJson: async () => {
        failures += 1
        if (failures <= 2) throw new Error("resolver fora")
        return { Status: 0, Answer: [{ type: DNS_TYPE_MX, data: "10 mx." }] }
      },
    }
    const cache = new DomainMailDnsCache(deps)
    expect(await cache.resolve("empresa.com.br")).toBe("unknown")
    expect(cache.size).toBe(0)
    expect(await cache.resolve("empresa.com.br")).toBe("deliverable")
    expect(cache.size).toBe(1)
  })

  it("resolves concorrentes do mesmo domínio compartilham a promise em voo", async () => {
    const calls: string[] = []
    const cache = new DomainMailDnsCache(
      buildDeps({ MX: { Status: 0, Answer: [{ type: DNS_TYPE_MX, data: "10 mx." }] } }, calls)
    )
    const [first, second] = await Promise.all([
      cache.resolve("empresa.com.br"),
      cache.resolve("empresa.com.br"),
    ])
    expect(first).toBe("deliverable")
    expect(second).toBe("deliverable")
    expect(calls).toHaveLength(1)
  })

  it("normaliza FQDN com ponto final e caixa alta", async () => {
    const calls: string[] = []
    const cache = new DomainMailDnsCache(
      buildDeps({ MX: { Status: 0, Answer: [{ type: DNS_TYPE_MX, data: "10 mx." }] } }, calls)
    )
    await cache.resolve("Empresa.COM.BR.")
    await cache.resolve("empresa.com.br")
    expect(calls).toHaveLength(1)
  })
})
