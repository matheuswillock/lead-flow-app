import { describe, expect, it } from "bun:test"
import { createChargeSourceReader } from "./chargeSourceReader"

const base = { id: "charge-1", providerContext: "primary", providerExternalId: "pay_1", providerAttemptId: "attempt-1", purposeRefId: "ref-1" }

function reader(overrides: Partial<Parameters<typeof createChargeSourceReader>[0]> = {}) {
  return createChargeSourceReader({
    asaasEvents: {
      findLatestPaymentEvent: async () => ({ valueInReais: 99.9, status: "RECEIVED", event: "PAYMENT_RECEIVED" }),
      listPaymentIdsReceivedSince: async () => [],
    },
    attempts: { findAttemptById: async () => ({ status: "CONFIRMED" }) as never },
    owners: { snapshot: async () => ({ amountCents: 500 }) as never },
    ...overrides,
  })
}

describe("chargeSourceReader", () => {
  it("ASAAS_SHADOW lê o último evento do webhook em centavos e status normalizado", async () => {
    const snapshot = await reader().read({ ...base, source: "ASAAS_SHADOW" } as never)
    expect(snapshot).toEqual({ amountCents: 9990, status: "CONFIRMED" })
  })

  it("ASAAS_SHADOW sem evento recebido é fonte ausente", async () => {
    const snapshot = await reader({
      asaasEvents: { findLatestPaymentEvent: async () => null, listPaymentIdsReceivedSince: async () => [] },
    }).read({ ...base, source: "ASAAS_SHADOW" } as never)
    expect(snapshot).toBeNull()
  })

  it("MIRROR compara com a tentativa do router e com o valor do dono", async () => {
    const snapshot = await reader().read({ ...base, source: "MIRROR", purpose: "ADHESION" } as never)
    expect(snapshot).toEqual({ amountCents: 500, status: "CONFIRMED" })
  })

  it("MIRROR sem tentativa vinculada é fonte ausente", async () => {
    const snapshot = await reader().read({ ...base, providerAttemptId: null, source: "MIRROR", purpose: "ADHESION" } as never)
    expect(snapshot).toBeNull()
  })
})
