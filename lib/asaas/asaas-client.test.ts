import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const addBreadcrumbMock = mock((_breadcrumb: Record<string, unknown>) => {})
const captureMessageMock = mock((_message: string, _context?: Record<string, unknown>) => "")

mock.module("@sentry/nextjs", () => ({
  addBreadcrumb: addBreadcrumbMock,
  captureMessage: captureMessageMock,
}))

const { createAsaasClient } = await import("./asaas-client")

const ENV_KEYS = [
  "ASAAS_ENV",
  "ASAAS_URL",
  "ASAAS_URL_sandbox",
  "ASAAS_API_KEY",
  "ASAAS_LEGACY_API_KEY",
] as const

let snapshot: Record<string, string | undefined> = {}

beforeEach(() => {
  snapshot = {}
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key]
    delete process.env[key]
  }
  addBreadcrumbMock.mockClear()
  captureMessageMock.mockClear()
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete process.env[key]
    else process.env[key] = snapshot[key]
  }
  mock.restore()
})

describe("createAsaasClient", () => {
  it("legacy: monta header access_token com a chave legacy (prefixo $ preservado)", async () => {
    process.env.ASAAS_ENV = "sandbox"
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"

    let capturedHeaders: Record<string, string> | undefined
    const fetchMock = mock(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const client = createAsaasClient("legacy")
    await client.request(client.endpoints.customers, { method: "GET" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(capturedHeaders?.access_token).toBe("$aact_legacy_key")
    expect(client.endpoints.customers).toBe("https://sandbox.asaas.com/api/v3/customers")
  })

  it("primary: se comporta idêntico ao asaasFetch atual (URL + headers) — trava compat dos 85 call-sites", async () => {
    process.env.ASAAS_ENV = "sandbox"
    process.env.ASAAS_API_KEY = "aact_primary_key"

    let capturedUrl: string | undefined
    let capturedHeaders: Record<string, string> | undefined
    let capturedOptions: RequestInit | undefined
    const fetchMock = mock(async (url: string, init?: RequestInit) => {
      capturedUrl = url
      capturedHeaders = init?.headers as Record<string, string>
      capturedOptions = init
      return new Response(JSON.stringify({ id: "cus_123" }), { status: 200 })
    })
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const client = createAsaasClient("primary")
    const result = await client.request(client.endpoints.customers, {
      method: "POST",
      body: JSON.stringify({ name: "Fulano" }),
    })

    expect(capturedUrl).toBe("https://sandbox.asaas.com/api/v3/customers")
    expect(capturedHeaders?.["access_token"]).toBe("$aact_primary_key")
    expect(capturedHeaders?.["Content-Type"]).toBe("application/json")
    expect(capturedOptions?.cache).toBe("no-store")
    expect(result).toEqual({ id: "cus_123" })
  })

  it("propaga o statusCode e a mensagem de erro do Asaas quando a resposta não é ok", async () => {
    process.env.ASAAS_ENV = "sandbox"
    process.env.ASAAS_API_KEY = "aact_primary_key"

    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ errors: [{ description: "CPF inválido" }] }), { status: 400 })
    )
    // @ts-expect-error override global fetch for the test
    globalThis.fetch = fetchMock

    const client = createAsaasClient("primary")

    let caught: any
    try {
      await client.request(client.endpoints.customers, { method: "POST" })
    } catch (error) {
      caught = error
    }

    expect(caught?.message).toBe("CPF inválido")
    expect(caught?.statusCode).toBe(400)
  })

  it("primary sem ASAAS_API_KEY → lança 'ASAAS_API_KEY não configurada' (mensagem histórica)", async () => {
    process.env.ASAAS_ENV = "sandbox"

    const client = createAsaasClient("primary")

    await expect(client.request(client.endpoints.customers)).rejects.toThrow(
      "ASAAS_API_KEY não configurada"
    )
  })

  describe("T-30.23 (E7/X3): observabilidade por conta", () => {
    it("toda chamada carrega a tag de conta via breadcrumb, sucesso ou erro", async () => {
      process.env.ASAAS_ENV = "sandbox"
      process.env.ASAAS_API_KEY = "aact_primary_key"
      const fetchMock = mock(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
      // @ts-expect-error override global fetch for the test
      globalThis.fetch = fetchMock

      const client = createAsaasClient("primary")
      await client.request(client.endpoints.customers)

      expect(addBreadcrumbMock).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "asaas",
          data: expect.objectContaining({ asaasAccount: "primary", entityIdPrefix: null }),
        })
      )
    })

    it("404 em cus_/sub_/pay_ na conta legacy dispara alerta com fingerprint dedicado", async () => {
      process.env.ASAAS_ENV = "sandbox"
      process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"
      const fetchMock = mock(
        async () => new Response(JSON.stringify({ errors: [] }), { status: 404 })
      )
      // @ts-expect-error override global fetch for the test
      globalThis.fetch = fetchMock

      const client = createAsaasClient("legacy")

      await expect(
        client.request(`${client.endpoints.customers}/cus_dead`)
      ).rejects.toThrow()

      expect(captureMessageMock).toHaveBeenCalledTimes(1)
      const [, context] = captureMessageMock.mock.calls[0] as [
        string,
        { fingerprint: string[] },
      ]
      expect(context.fingerprint).toEqual(["asaas-legacy-404", "cus"])
    })

    it("404 na conta primary NÃO dispara o alerta de legado (só faz sentido na conta legacy)", async () => {
      process.env.ASAAS_ENV = "sandbox"
      process.env.ASAAS_API_KEY = "aact_primary_key"
      const fetchMock = mock(
        async () => new Response(JSON.stringify({ errors: [] }), { status: 404 })
      )
      // @ts-expect-error override global fetch for the test
      globalThis.fetch = fetchMock

      const client = createAsaasClient("primary")

      await expect(client.request(`${client.endpoints.customers}/cus_dead`)).rejects.toThrow()

      expect(captureMessageMock).not.toHaveBeenCalled()
    })

    it("404 num endpoint sem prefixo de ID (listagem) NÃO dispara o alerta de legado", async () => {
      process.env.ASAAS_ENV = "sandbox"
      process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"
      const fetchMock = mock(
        async () => new Response(JSON.stringify({ errors: [] }), { status: 404 })
      )
      // @ts-expect-error override global fetch for the test
      globalThis.fetch = fetchMock

      const client = createAsaasClient("legacy")

      await expect(client.request(client.endpoints.customers)).rejects.toThrow()

      expect(captureMessageMock).not.toHaveBeenCalled()
    })
  })
})
