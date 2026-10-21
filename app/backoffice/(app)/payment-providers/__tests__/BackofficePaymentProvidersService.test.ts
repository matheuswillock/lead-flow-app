import { afterEach, describe, expect, it } from "bun:test"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { BackofficePaymentProvidersService } from "../features/services/BackofficePaymentProvidersService"
import { PaymentProvidersApiError } from "../features/context/BackofficePaymentProvidersTypes"
import { SECRET_SENTINEL, makeInstance } from "./testHarness"

const BASE = `${API_CLIENT_BASE}/backoffice/payment-providers/config`
const originalFetch = globalThis.fetch

interface Captured {
  url: string
  init?: RequestInit
}

function stubFetch(status: number, body: unknown): Captured[] {
  const captured: Captured[] = []
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    captured.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return captured
}

const ok = (result: unknown) => ({ isValid: true, successMessages: [], errorMessages: [], result })

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("BackofficePaymentProvidersService", () => {
  it("lista instâncias montando a URL com API_CLIENT_BASE e o ambiente", async () => {
    const calls = stubFetch(200, ok([makeInstance()]))
    const items = await new BackofficePaymentProvidersService().listInstances("DEV")
    expect(calls[0].url).toBe(`${BASE}?environment=DEV`)
    expect(items).toHaveLength(1)
  })

  it("lista adapters desembrulhando { adapters }", async () => {
    stubFetch(200, ok({ adapters: [{ providerKey: "ASAAS" }] }))
    const adapters = await new BackofficePaymentProvidersService().listAdapters()
    expect(adapters).toHaveLength(1)
  })

  it("envia expectedRevision no PUT de atualização", async () => {
    const calls = stubFetch(200, ok(makeInstance()))
    await new BackofficePaymentProvidersService().updateInstance({ id: "cfg-1", expectedRevision: 7, isDefault: true })
    expect(calls[0].init?.method).toBe("PUT")
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ id: "cfg-1", expectedRevision: 7, isDefault: true })
  })

  it("envia o valor da credencial só no PUT de credencial", async () => {
    const calls = stubFetch(200, ok(makeInstance()))
    await new BackofficePaymentProvidersService().setCredential("cfg-1", "API_KEY", SECRET_SENTINEL)
    expect(calls[0].url).toBe(`${BASE}/credentials`)
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ configId: "cfg-1", key: "API_KEY", value: SECRET_SENTINEL })
  })

  it("nunca coloca valor de credencial em URL de leitura, remoção ou histórico", async () => {
    const calls = stubFetch(200, ok({ items: [] }))
    const service = new BackofficePaymentProvidersService()
    await service.listInstances("PRODUCTION")
    await service.listHistory("cfg-1")
    await service.removeCredential("cfg-1", "API_KEY")
    expect(calls[1].url).toBe(`${BASE}/history?configId=cfg-1`)
    expect(calls[2].url).toBe(`${BASE}/credentials?configId=cfg-1&key=API_KEY`)
    expect(calls[2].init?.method).toBe("DELETE")
    for (const call of calls) expect(JSON.stringify(call)).not.toContain(SECRET_SENTINEL)
  })

  it("dispara health-check e criação com os corpos do contrato", async () => {
    const calls = stubFetch(200, ok(makeInstance()))
    const service = new BackofficePaymentProvidersService()
    await service.runHealthCheck("cfg-1")
    await service.createInstance({
      providerKey: "ASAAS",
      environment: "DEV",
      externalAccountContext: "conta-b",
      displayName: "Asaas B",
    })
    expect(calls[0].url).toBe(`${BASE}/health-check`)
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ id: "cfg-1" })
    expect(calls[1].url).toBe(BASE)
    expect(calls[1].init?.method).toBe("POST")
  })

  it("converte 409 em erro com status e mensagem do envelope", async () => {
    stubFetch(409, { isValid: false, errorMessages: ["Revisão desatualizada"], successMessages: [], result: null })
    const error = await new BackofficePaymentProvidersService()
      .updateInstance({ id: "cfg-1", expectedRevision: 1, enabled: true })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(PaymentProvidersApiError)
    expect((error as PaymentProvidersApiError).isConflict).toBe(true)
    expect((error as Error).message).toBe("Revisão desatualizada")
  })
})
