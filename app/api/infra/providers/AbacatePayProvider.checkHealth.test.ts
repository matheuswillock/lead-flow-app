import { describe, expect, it, mock } from "bun:test"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import { AbacatePayProvider } from "./AbacatePayProvider"

const API_KEY = "sk_live_super_secret_key"
const config = PaymentProviderConfig.create({
  apiKey: API_KEY,
  publicKey: null,
  webhookSecret: "webhook-secret",
  webhookSigningKey: null,
  environment: "PRODUCTION",
  devMode: false,
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("AbacatePayProvider.checkHealth", () => {
  it("consulta GET /v2/stores/get autenticado e reporta saudável", async () => {
    const http = mock(async () => json({ success: true, data: { id: "store_1", name: "Loja" } }))
    const provider = new AbacatePayProvider(config, { http })

    expect(await provider.checkHealth()).toEqual({ healthy: true })

    const [url, init] = http.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.abacatepay.com/v2/stores/get")
    expect(init.method).toBe("GET")
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${API_KEY}`)
  })

  it("reporta não saudável em 401 sem vazar a chave", async () => {
    const http = mock(async () => json({ error: `invalid ${API_KEY}` }, 401))
    const provider = new AbacatePayProvider(config, { http })

    const result = await provider.checkHealth()

    expect(result.healthy).toBe(false)
    expect(result).toMatchObject({ errorCode: "AUTHENTICATION_FAILED" })
    expect(JSON.stringify(result)).not.toContain(API_KEY)
  })

  it("reporta não saudável quando a rede falha, sem lançar", async () => {
    const http = mock(async () => {
      throw new Error(`boom ${API_KEY}`)
    })
    const provider = new AbacatePayProvider(config, { http })

    const result = await provider.checkHealth()

    expect(result.healthy).toBe(false)
    expect(JSON.stringify(result)).not.toContain(API_KEY)
  })

  it("trata success=false e resposta sem id de loja como não saudável", async () => {
    const refused = new AbacatePayProvider(config, {
      http: mock(async () => json({ success: false })),
    })
    const withoutStore = new AbacatePayProvider(config, {
      http: mock(async () => json({ success: true, data: {} })),
    })

    expect((await refused.checkHealth()).healthy).toBe(false)
    expect((await withoutStore.checkHealth()).healthy).toBe(false)
  })
})
