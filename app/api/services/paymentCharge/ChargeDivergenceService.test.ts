import { describe, expect, it, mock } from "bun:test"
import { InMemoryPaymentChargeRepository } from "@/test/support/in-memory-payment-charge-repository"
import { ChargeLedger, type RecordChargeInput } from "./ChargeLedger"
import { ChargeDivergenceService, type ChargeSourceReader } from "./ChargeDivergenceService"

const NOW = new Date("2026-10-21T12:00:00.000Z")

async function setup(sourceFor: ChargeSourceReader["read"], expectedShadow: Array<{ account: "primary" | "legacy"; paymentId: string }> = []) {
  const charges = new InMemoryPaymentChargeRepository()
  const ledger = new ChargeLedger({ charges, now: () => NOW, logError: () => undefined })
  const report = mock((_divergences: readonly unknown[]) => undefined)
  const service = new ChargeDivergenceService({
    charges,
    source: { read: sourceFor, listExpectedShadowPayments: async () => expectedShadow },
    report,
    asaasEnvironment: () => "PRODUCTION",
    now: () => NOW,
  })
  const record = (overrides: Partial<RecordChargeInput> = {}) =>
    ledger.record({
      profileId: "profile-1",
      purpose: "SUBSCRIPTION_RENEWAL",
      status: "CONFIRMED",
      amountCents: 9990,
      provider: "ASAAS",
      providerEnvironment: "PRODUCTION",
      providerContext: "primary",
      providerExternalId: "pay_1",
      idempotencyKey: "asaas:primary:pay_1",
      source: "ASAAS_SHADOW",
      ...overrides,
    })
  return { service, record, report, charges }
}

describe("ChargeDivergenceService", () => {
  it("sem diferença: nada é reportado", async () => {
    const { service, record, report } = await setup(async () => ({ amountCents: 9990, status: "CONFIRMED" }))
    await record()

    const result = await service.run({ windowHours: 24, limit: 100 })

    expect(result).toMatchObject({ checked: 1, divergences: [] })
    expect(report).not.toHaveBeenCalled()
  })

  it("detecta diferença de valor", async () => {
    const { service, record, report } = await setup(async () => ({ amountCents: 10000, status: "CONFIRMED" }))
    await record()

    const result = await service.run({ windowHours: 24, limit: 100 })

    expect(result.divergences).toEqual([
      { chargeId: "charge-1", kind: "AMOUNT", ledger: 9990, source: 10000 },
    ])
    expect(report).toHaveBeenCalledTimes(1)
  })

  it("detecta diferença de status, mas trata CONFIRMED e COMPLETED como o mesmo estado pago", async () => {
    const mismatch = await setup(async () => ({ amountCents: 9990, status: "PENDING" }))
    await mismatch.record()
    expect((await mismatch.service.run({ windowHours: 24, limit: 10 })).divergences[0]).toMatchObject({ kind: "STATUS" })

    const paid = await setup(async () => ({ amountCents: 9990, status: "CONFIRMED" }))
    await paid.record({ status: "COMPLETED" })
    expect((await paid.service.run({ windowHours: 24, limit: 10 })).divergences).toEqual([])
  })

  it("detecta ausência da fonte", async () => {
    const { service, record } = await setup(async () => null)
    await record()

    const result = await service.run({ windowHours: 24, limit: 100 })

    expect(result.divergences).toEqual([{ chargeId: "charge-1", kind: "MISSING_SOURCE", ledger: null, source: null }])
  })

  it("detecta pagamento do Asaas recebido que não tem linha no ledger", async () => {
    const { service } = await setup(async () => ({ amountCents: 1, status: "CONFIRMED" }), [
      { account: "legacy", paymentId: "pay_ghost" },
    ])

    const result = await service.run({ windowHours: 24, limit: 100 })

    expect(result.divergences).toEqual([
      { chargeId: null, kind: "MISSING_CHARGE", ledger: null, source: "legacy:pay_ghost" },
    ])
  })

  it("não corrige nada: o ledger fica intocado", async () => {
    const { service, record, charges } = await setup(async () => ({ amountCents: 1, status: "FAILED" }))
    await record()
    const before = JSON.stringify(charges.charges)

    await service.run({ windowHours: 24, limit: 100 })

    expect(JSON.stringify(charges.charges)).toBe(before)
  })

  it("ignora linhas ROUTER (só espelhos são comparados)", async () => {
    const { service, record } = await setup(async () => null)
    await record({ source: "ROUTER" })

    expect((await service.run({ windowHours: 24, limit: 100 })).checked).toBe(0)
  })
})
