/**
 * T-30.3 — prova em sandbox real que o inventário nunca escreve.
 *
 * Fica fora do `bun test` default (`**\/*.integration.test.ts` é ignorado no
 * script `test` do package.json) e só roda com opt-in explícito, contra
 * SANDBOX — nunca produção (`assertAsaasSandbox()` no `beforeAll` aborta se
 * detectar produção).
 *
 * Rodar:
 *   RUN_INTEGRATION=1 ASAAS_ENV=sandbox ASAAS_SANDBOX_API_KEY=aact_... \
 *   bun test scripts/billing/asaas-account-inventory.integration.test.ts
 */

import { afterEach, beforeAll, describe, expect, it, mock } from "bun:test"
import { assertAsaasSandbox } from "@/e2e/support/asaas"
import { createAsaasReadOnlyGateway, fetchAllPages } from "./lib/asaasReadOnlyGateway"
import type { AsaasCustomer } from "./lib/asaasInventoryTypes"

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "1"

describe.if(RUN_INTEGRATION)("asaas-account-inventory — integração sandbox (T-30.3)", () => {
  beforeAll(() => {
    assertAsaasSandbox()
  })

  afterEach(() => {
    mock.restore()
  })

  it("pagina customers em sandbox e nunca emite POST/PUT/DELETE — read-only por construção", async () => {
    const realFetch = globalThis.fetch
    const capturedMethods: string[] = []

    const spy = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedMethods.push((init?.method ?? "GET").toUpperCase())
      return realFetch(input, init)
    })
    // @ts-expect-error espiona o fetch global sem trocar o transporte real —
    // as chamadas continuam indo pro sandbox de verdade.
    globalThis.fetch = spy

    try {
      const gateway = createAsaasReadOnlyGateway("primary")
      const customers = await fetchAllPages<AsaasCustomer>(gateway, "/customers", 10)

      expect(Array.isArray(customers)).toBe(true)
      expect(spy.mock.calls.length).toBeGreaterThan(0)
      expect(capturedMethods.length).toBeGreaterThan(0)
      for (const method of capturedMethods) {
        expect(method).toBe("GET")
      }
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
