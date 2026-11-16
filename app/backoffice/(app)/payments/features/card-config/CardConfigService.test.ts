import { afterEach, describe, expect, it, mock } from "bun:test"
import { CardConfigRequestError, CardConfigService } from "./CardConfigService"

const originalFetch = globalThis.fetch

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = mock(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
  ;(globalThis as { fetch: typeof fetch }).fetch = fn as unknown as typeof fetch
  return fn
}

const abacate = (environment: string, cardEnabled: boolean, revision: number) => ({
  provider: "ABACATE_PAY",
  environment,
  enabled: true,
  cardEnabled,
  revision,
  publicKey: null,
})

describe("CardConfigService", () => {
  afterEach(() => {
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  })

  it("lista pelo ambiente e devolve só o registro do Abacate Pay", async () => {
    const fetchMock = stubFetch(() =>
      Response.json({
        isValid: true,
        result: [{ ...abacate("PRODUCTION", false, 1), provider: "ASAAS" }, abacate("PRODUCTION", true, 5)],
      })
    )
    const result = await new CardConfigService().getAbacateCardConfig("PRODUCTION")
    expect(result).toEqual({ environment: "PRODUCTION", cardEnabled: true, publicKey: null, revision: 5 })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/backoffice/payment-providers/config?environment=PRODUCTION"
    )
  })

  it("devolve null quando o ambiente não tem Abacate Pay", async () => {
    stubFetch(() => Response.json({ isValid: true, result: [{ ...abacate("DEV", false, 1), provider: "ASAAS" }] }))
    expect(await new CardConfigService().getAbacateCardConfig("DEV")).toBeNull()
  })

  it("o PUT manda provider, ambiente e patch com a revisão esperada", async () => {
    let body: unknown = null
    let method: string | undefined
    stubFetch((_url, init) => {
      method = init?.method
      body = JSON.parse(String(init?.body))
      return Response.json({ isValid: true, result: abacate("PRODUCTION", true, 7) })
    })
    const result = await new CardConfigService().setCardEnabled("PRODUCTION", true, 6)
    expect(method).toBe("PUT")
    expect(body).toEqual({
      environment: "PRODUCTION",
      provider: "ABACATE_PAY",
      patch: { cardEnabled: true, expectedRevision: 6 },
    })
    expect(result).toEqual({ environment: "PRODUCTION", cardEnabled: true, publicKey: null, revision: 7 })
  })

  it("salva chave pública específica por ambiente", async () => {
    let body: unknown
    stubFetch((_url, init) => {
      body = JSON.parse(String(init?.body))
      return Response.json({ isValid: true, result: { ...abacate("DEV", false, 3), publicKey: "pk_dev_12345678" } })
    })
    const result = await new CardConfigService().setPublicKey("DEV", "pk_dev_12345678", 2)
    expect(body).toEqual({ environment: "DEV", provider: "ABACATE_PAY", patch: { publicKey: "pk_dev_12345678", expectedRevision: 2 } })
    expect(result.publicKey).toBe("pk_dev_12345678")
  })

  it("lista configurações genéricas sem receber valores secretos", async () => {
    stubFetch(() => Response.json({ isValid: true, result: [
      {
        provider: "ABACATE_PAY",
        environment: "DEV",
        revision: 3,
        variables: [
          { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", configured: true },
          { name: "ABACATE_PAY_DEV_PUBLIC_KEY", visibility: "PUBLIC", configured: true, value: "pk_public_test" },
        ],
      },
    ] }))
    expect(await new CardConfigService().getProviderConfigs("DEV")).toEqual([{
      provider: "ABACATE_PAY",
      environment: "DEV",
      revision: 3,
      variables: [
        { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", configured: true },
        { name: "ABACATE_PAY_DEV_PUBLIC_KEY", visibility: "PUBLIC", configured: true, value: "pk_public_test" },
      ],
    }])
  })

  it("salva variáveis por provider e revisão sem retornar o segredo", async () => {
    let body: unknown
    stubFetch((_url, init) => {
      body = JSON.parse(String(init?.body))
      return Response.json({ isValid: true, result: {
        provider: "ABACATE_PAY",
        environment: "DEV",
        revision: 4,
        variables: [{ name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", configured: true }],
      } })
    })
    const result = await new CardConfigService().setProviderVariables("ABACATE_PAY", "DEV", [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-value" },
    ], 3)
    expect(body).toEqual({ environment: "DEV", provider: "ABACATE_PAY", patch: {
      variables: [{ name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-value" }],
      expectedRevision: 3,
    } })
    expect(result.variables).toEqual([{ name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", configured: true }])
    expect(JSON.stringify(result)).not.toContain("secret-value")
  })

  it("409 vira erro tipado com o status e a mensagem do servidor", async () => {
    stubFetch(() =>
      Response.json(
        { isValid: false, errorMessages: ["A revisão da configuração está desatualizada"] },
        { status: 409 }
      )
    )
    const promise = new CardConfigService().setCardEnabled("DEV", true, 1)
    await expect(promise).rejects.toBeInstanceOf(CardConfigRequestError)
    await expect(promise).rejects.toMatchObject({ status: 409 })
  })

  it("corpo que não é JSON vira erro tipado, sem estourar SyntaxError", async () => {
    stubFetch(() => new Response("<html>oops</html>", { status: 500 }))
    await expect(new CardConfigService().getAbacateCardConfig("DEV")).rejects.toMatchObject({
      name: "CardConfigRequestError",
      status: 500,
    })
  })
})
