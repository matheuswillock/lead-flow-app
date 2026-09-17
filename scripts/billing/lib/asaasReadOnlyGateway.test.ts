import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { AsaasReadOnlyGateway, fetchAllPages, type AsaasListResponse, type IAsaasReadOnlyGateway } from "./asaasReadOnlyGateway"

const ENV_KEYS = ["ASAAS_ENV", "ASAAS_URL", "ASAAS_URL_sandbox", "ASAAS_API_KEY", "ASAAS_LEGACY_API_KEY"] as const

let snapshot: Record<string, string | undefined> = {}

beforeEach(() => {
  snapshot = {}
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
  mock.restore()
})

// ── T-30.1: paginação agrega todas as páginas ────────────────────────────

type FakeItem = { id: string }

function buildFakeGateway(pages: FakeItem[][]): IAsaasReadOnlyGateway {
  return {
    accountId: "legacy",
    async fetchPage<T>(_path: string, offset: number, limit = 100): Promise<AsaasListResponse<T>> {
      const pageIndex = offset / limit
      const data = (pages[pageIndex] ?? []) as unknown as T[]
      const hasMore = pageIndex < pages.length - 1
      return {
        object: "list",
        hasMore,
        totalCount: pages.flat().length,
        limit,
        offset,
        data,
      }
    },
  }
}

describe("fetchAllPages", () => {
  it("agrega os dados das 3 páginas mockadas (hasMore true/true/false)", async () => {
    const pages: FakeItem[][] = [
      [{ id: "a1" }, { id: "a2" }],
      [{ id: "b1" }, { id: "b2" }],
      [{ id: "c1" }],
    ]
    const gateway = buildFakeGateway(pages)

    const result = await fetchAllPages<FakeItem>(gateway, "/customers", 2)

    expect(result).toEqual([{ id: "a1" }, { id: "a2" }, { id: "b1" }, { id: "b2" }, { id: "c1" }])
    expect(result.length).toBe(5)
  })

  it("controle negativo: gateway que suprime a última página faz a contagem cair", async () => {
    const fullPages: FakeItem[][] = [
      [{ id: "a1" }, { id: "a2" }],
      [{ id: "b1" }, { id: "b2" }],
      [{ id: "c1" }],
    ]
    // Simula o defeito "suprimir a última página no código": o gateway
    // nunca reporta hasMore=true na penúltima página, então a paginação
    // para cedo demais.
    const brokenGateway: IAsaasReadOnlyGateway = {
      accountId: "legacy",
      async fetchPage<T>(_path: string, offset: number, limit = 100): Promise<AsaasListResponse<T>> {
        const pageIndex = offset / limit
        const data = (fullPages[pageIndex] ?? []) as unknown as T[]
        return {
          object: "list",
          hasMore: false, // defeito proposital: nunca continua
          totalCount: fullPages.flat().length,
          limit,
          offset,
          data,
        }
      },
    }

    const result = await fetchAllPages<FakeItem>(brokenGateway, "/customers", 2)

    expect(result.length).toBe(2) // caiu de 5 para 2 — o teste fica vermelho
    expect(result.length).not.toBe(5)
  })

  it("uma única página sem hasMore não itera de novo", async () => {
    const gateway = buildFakeGateway([[{ id: "only" }]])
    const result = await fetchAllPages<FakeItem>(gateway, "/subscriptions", 100)
    expect(result).toEqual([{ id: "only" }])
  })
})

// ── Read-only por construção: fetchPage sempre GET ────────────────────────

describe("AsaasReadOnlyGateway", () => {
  it("fetchPage sempre emite GET, nunca envia body — nenhum outro verbo é alcançável", async () => {
    process.env.ASAAS_ENV = "sandbox"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"

    const capturedRequests: Array<{ url: string; init?: RequestInit }> = []
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      capturedRequests.push({ url, init })
      return new Response(JSON.stringify({ object: "list", hasMore: false, totalCount: 0, limit: 100, offset: 0, data: [] }), {
        status: 200,
      })
    })
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const gateway = new AsaasReadOnlyGateway("legacy")
    await gateway.fetchPage("/customers", 0)
    await gateway.fetchPage("/subscriptions", 0, 50)
    await gateway.fetchPage("/payments?status=PENDING", 0)
    await gateway.fetchPage("/webhooks", 0)

    expect(capturedRequests.length).toBe(4)
    for (const req of capturedRequests) {
      expect(req.init?.method).toBe("GET")
      expect(req.init?.body).toBeUndefined()
    }
    expect(capturedRequests[0]?.url).toBe("https://sandbox.asaas.com/api/v3/customers?limit=100&offset=0")
    expect(capturedRequests[1]?.url).toBe("https://sandbox.asaas.com/api/v3/subscriptions?limit=50&offset=0")
    expect(capturedRequests[2]?.url).toBe(
      "https://sandbox.asaas.com/api/v3/payments?status=PENDING&limit=100&offset=0"
    )
  })

  it("interface não expõe nenhum método além de fetchPage (TypeScript garante em tempo de compilação)", () => {
    // Este teste documenta a garantia estrutural: qualquer tentativa de
    // chamar gateway.post/put/delete/request(...) falha no typecheck porque
    // IAsaasReadOnlyGateway só declara fetchPage. Não há verificação
    // adicional em runtime a fazer aqui além de confirmar o shape.
    process.env.ASAAS_ENV = "sandbox"
    const gateway = new AsaasReadOnlyGateway("primary")
    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(gateway))
    expect(keys).toContain("fetchPage")
    expect(keys).not.toContain("post")
    expect(keys).not.toContain("put")
    expect(keys).not.toContain("delete")
  })
})
