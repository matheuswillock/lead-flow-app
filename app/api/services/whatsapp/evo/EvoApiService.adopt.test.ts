import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { EvoApiService, EvoProviderError, isInstanceNameAlreadyInUseError } from "./EvoApiService"

const INSTANCE = "team_32ccdbe1627f4fe3"
const WEBHOOK_URL = "http://localhost:3000/api/webhooks/whatsapp/evolution/secret"
const BASE_URL = "http://evo.test"

const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function errorResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("isInstanceNameAlreadyInUseError", () => {
  it("detecta 403 com nome já em uso", () => {
    const error = new EvoProviderError("instance_name_in_use", "correlation-id", 403)
    expect(isInstanceNameAlreadyInUseError(error)).toBe(true)
  })

  it("ignora outros erros", () => {
    expect(isInstanceNameAlreadyInUseError(new Error("HTTP 500"))).toBe(false)
    expect(isInstanceNameAlreadyInUseError("not an error")).toBe(false)
  })
})

describe("EvoApiService.adoptOrCreateInstance", () => {
  const service = new EvoApiService()
  const fetchCalls: Array<{ url: string; method: string }> = []

  beforeEach(() => {
    fetchCalls.length = 0
    process.env.EVO_API_BASE_URL = BASE_URL
    process.env.EVO_API_KEY = "test-key"
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("cria instância normalmente sem chamar setWebhook", async () => {
    globalThis.fetch = mock(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      fetchCalls.push({ url, method })

      if (url.endsWith("/instance/create")) {
        return jsonResponse({
          instance: { instanceName: INSTANCE, instanceId: "evo-1", status: "close" },
          qrcode: { code: "qr-text", base64: "qr-base64" },
        })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const result = await service.adoptOrCreateInstance({
      instanceName: INSTANCE,
      webhookUrl: WEBHOOK_URL,
    })

    expect(result.adopted).toBe(false)
    expect(result.instanceName).toBe(INSTANCE)
    expect(result.qrCode).toEqual({ text: "qr-text", base64: "qr-base64" })
    expect(fetchCalls.some((call) => call.url.includes("/webhook/set/"))).toBe(false)
  })

  it("adota instância existente após 403 already in use", async () => {
    globalThis.fetch = mock(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      fetchCalls.push({ url, method })

      if (url.endsWith("/instance/create")) {
        return errorResponse(
          {
            status: 403,
            error: "Forbidden",
            response: { message: [`This name "${INSTANCE}" is already in use.`] },
          },
          403
        )
      }

      if (url.includes("/instance/fetchInstances")) {
        return jsonResponse([{ instanceName: INSTANCE, owner: "5511999999999@s.whatsapp.net" }])
      }

      if (url.includes("/webhook/set/")) {
        return jsonResponse({ webhook: { enabled: true } })
      }

      if (url.includes("/instance/connectionState/")) {
        return jsonResponse({ instance: { instanceName: INSTANCE, state: "connecting" } })
      }

      if (url.includes("/instance/connect/")) {
        return jsonResponse({ code: "qr-adopt", base64: "qr-adopt-base64" })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const result = await service.adoptOrCreateInstance({
      instanceName: INSTANCE,
      webhookUrl: WEBHOOK_URL,
    })

    expect(result.adopted).toBe(true)
    expect(result.status).toBe("connecting")
    expect(result.qrCode).toEqual({ text: "qr-adopt", base64: "qr-adopt-base64" })
    expect(fetchCalls.some((call) => call.url.includes("/webhook/set/"))).toBe(true)
  })

  it("propaga erro quando 403 não encontra instância em fetchInstance", async () => {
    globalThis.fetch = mock(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"

      if (url.endsWith("/instance/create")) {
        return errorResponse(
          {
            status: 403,
            response: { message: ["already in use"] },
          },
          403
        )
      }

      if (url.includes("/instance/fetchInstances")) {
        return jsonResponse([])
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(
      service.adoptOrCreateInstance({
        instanceName: INSTANCE,
        webhookUrl: WEBHOOK_URL,
      })
    ).rejects.toMatchObject({ code: "instance_name_in_use", httpStatus: 403 })
  })

  it("propaga erro HTTP 500 sem tentar adopt", async () => {
    globalThis.fetch = mock(async (input) => {
      const url = String(input)

      if (url.endsWith("/instance/create")) {
        return errorResponse({ status: 500, error: "Internal Server Error" }, 500)
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    await expect(
      service.adoptOrCreateInstance({
        instanceName: INSTANCE,
        webhookUrl: WEBHOOK_URL,
      })
    ).rejects.toMatchObject({ code: "provider_http", httpStatus: 500 })
  })

  it("preserva falha de rede como entrega incerta", async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch

    await expect(
      service.adoptOrCreateInstance({
        instanceName: INSTANCE,
        webhookUrl: WEBHOOK_URL,
      })
    ).rejects.toMatchObject({ code: "provider_network" })
  })
})
