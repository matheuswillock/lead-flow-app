import { describe, expect, it, mock } from "bun:test"
import { InMemoryPaymentChargeRepository } from "@/test/support/in-memory-payment-charge-repository"
import { ChargeLedger, type RecordChargeInput } from "./ChargeLedger"

const NOW = new Date("2026-10-21T12:00:00.000Z")

function makeLedger() {
  const charges = new InMemoryPaymentChargeRepository()
  const logError = mock((_message: string, _context: Record<string, unknown>) => undefined)
  const ledger = new ChargeLedger({ charges, logError, now: () => NOW })
  return { ledger, charges, logError }
}

function input(overrides: Partial<RecordChargeInput> = {}): RecordChargeInput {
  return {
    profileId: "profile-1",
    purpose: "PLATFORM_PURCHASE",
    purposeRefId: "purchase-1",
    status: "PENDING",
    amountCents: 4990,
    provider: "ABACATE_PAY",
    providerEnvironment: "PRODUCTION",
    providerContext: "primary",
    providerExternalId: "pix_1",
    idempotencyKey: "mirror:PLATFORM_PURCHASE:purchase-1",
    source: "MIRROR",
    ...overrides,
  }
}

describe("ChargeLedger.record", () => {
  it("cria a cobrança com BRL e grava o evento inicial", async () => {
    const { ledger, charges } = makeLedger()

    const result = await ledger.record(input())

    expect(result.ok).toBe(true)
    expect(charges.charges).toHaveLength(1)
    expect(charges.charges[0].currency).toBe("BRL")
    expect(charges.events).toHaveLength(1)
    expect(charges.events[0]).toMatchObject({ fromStatus: null, toStatus: "PENDING", actor: "MIRROR" })
  })

  it("grava profileRef igual ao perfil dono, como cópia imutável", async () => {
    const { ledger, charges } = makeLedger()

    await ledger.record(input())

    expect(charges.charges[0]).toMatchObject({ profileId: "profile-1", profileRef: "profile-1" })
  })

  it("depois que a conta é apagada (profile_id NULL) a idempotência continua por profileRef: sem duplicar", async () => {
    const { ledger, charges } = makeLedger()
    await ledger.record(input())

    charges.deleteProfile("profile-1")
    const again = await ledger.record(input({ status: "CONFIRMED" }))

    expect(again).toMatchObject({ ok: true, outcome: "transitioned" })
    expect(charges.charges).toHaveLength(1)
    expect(charges.charges[0]).toMatchObject({ profileId: null, profileRef: "profile-1", status: "CONFIRMED" })
  })

  it("é idempotente por chave: repetir o mesmo registro não duplica linha nem evento", async () => {
    const { ledger, charges } = makeLedger()

    await ledger.record(input())
    const second = await ledger.record(input())

    expect(second).toMatchObject({ ok: true, outcome: "unchanged" })
    expect(charges.charges).toHaveLength(1)
    expect(charges.events).toHaveLength(1)
  })

  it("é idempotente pela identidade externa mesmo com outra chave de idempotência", async () => {
    const { ledger, charges } = makeLedger()

    await ledger.record(input())
    await ledger.record(input({ idempotencyKey: "outra-chave", status: "CONFIRMED" }))

    expect(charges.charges).toHaveLength(1)
    expect(charges.charges[0].status).toBe("CONFIRMED")
  })

  it("registra cada transição com status anterior, novo e bruto", async () => {
    const { ledger, charges } = makeLedger()

    await ledger.record(input())
    await ledger.record(input({ status: "CONFIRMED", rawStatus: "RECEIVED" }))
    await ledger.record(input({ status: "COMPLETED" }))

    expect(charges.events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
      [null, "PENDING"],
      ["PENDING", "CONFIRMED"],
      ["CONFIRMED", "COMPLETED"],
    ])
    expect(charges.events[1].rawStatus).toBe("RECEIVED")
    expect(charges.charges[0].paidAt).toEqual(NOW)
  })

  it("evento fora de ordem (PENDING depois de CONFIRMED) não regride a cobrança", async () => {
    const { ledger, charges } = makeLedger()

    await ledger.record(input({ status: "CONFIRMED" }))
    const late = await ledger.record(input({ status: "PENDING" }))

    expect(late).toMatchObject({ ok: true, outcome: "unchanged" })
    expect(charges.charges[0].status).toBe("CONFIRMED")
    expect(charges.events).toHaveLength(1)
  })

  it("completa ids de tentativa e sessão sem sobrescrever os existentes", async () => {
    const { ledger, charges } = makeLedger()

    await ledger.record(input({ providerAttemptId: "attempt-1" }))
    await ledger.record(input({ providerAttemptId: "attempt-2", providerSessionId: "session-1" }))

    expect(charges.charges[0].providerAttemptId).toBe("attempt-1")
    expect(charges.charges[0].providerSessionId).toBe("session-1")
  })

  it("perde a corrida de criação (unicidade) e converge para a linha vencedora", async () => {
    const { ledger, charges } = makeLedger()
    charges.beforeCreate = async () => {
      await charges.create({ ...input({ status: "CONFIRMED" }), actor: "ROUTER" })
    }

    const result = await ledger.record(input())

    expect(result).toMatchObject({ ok: true, outcome: "unchanged" })
    expect(charges.charges).toHaveLength(1)
    expect(charges.charges[0].status).toBe("CONFIRMED")
  })

  it("nunca lança: falha do repositório vira resultado com log estruturado", async () => {
    const { ledger, charges, logError } = makeLedger()
    charges.failNextCreate = new Error("db down")

    const result = await ledger.record(input())

    expect(result).toEqual({ ok: false, reason: "db down" })
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0][1]).toMatchObject({ purpose: "PLATFORM_PURCHASE", source: "MIRROR" })
  })

  it("rejeita valor inválido sem lançar", async () => {
    const { ledger, charges } = makeLedger()

    const result = await ledger.record(input({ amountCents: 10.5 }))

    expect(result.ok).toBe(false)
    expect(charges.charges).toHaveLength(0)
  })
})

describe("ChargeLedger.transition", () => {
  it("avança por compare-and-set e propaga erro quando a cobrança não existe", async () => {
    const { ledger, charges } = makeLedger()
    await ledger.record(input())

    const moved = await ledger.transition({ chargeId: "charge-1", toStatus: "COMPLETED", actor: "SETTLEMENT" })
    expect(moved.status).toBe("COMPLETED")
    expect(charges.events.at(-1)).toMatchObject({ fromStatus: "PENDING", toStatus: "COMPLETED", actor: "SETTLEMENT" })

    await expect(
      ledger.transition({ chargeId: "nope", toStatus: "COMPLETED", actor: "SETTLEMENT" }),
    ).rejects.toThrow("Cobrança não encontrada")
  })

  it("é idempotente quando já está no status pedido", async () => {
    const { ledger, charges } = makeLedger()
    await ledger.record(input({ status: "COMPLETED" }))

    const result = await ledger.transition({ chargeId: "charge-1", toStatus: "COMPLETED", actor: "SETTLEMENT" })

    expect(result.status).toBe("COMPLETED")
    expect(charges.events).toHaveLength(1)
  })
})

describe("ChargeLedger.transition e paidAt", () => {
  it("CONFIRMED -> COMPLETED não regrava o paidAt já gravado", async () => {
    const charges = new InMemoryPaymentChargeRepository()
    let clock = new Date("2026-10-21T12:00:00.000Z")
    const ledger = new ChargeLedger({ charges, now: () => clock, logError: () => undefined })
    await ledger.record(input({ status: "PENDING" }))
    await ledger.transition({ chargeId: "charge-1", toStatus: "CONFIRMED", actor: "SETTLEMENT" })
    const firstPaidAt = charges.charges[0].paidAt

    clock = new Date("2026-10-22T09:00:00.000Z")
    await ledger.transition({ chargeId: "charge-1", toStatus: "COMPLETED", actor: "SETTLEMENT" })

    expect(firstPaidAt).toEqual(new Date("2026-10-21T12:00:00.000Z"))
    expect(charges.charges[0].paidAt).toEqual(firstPaidAt)
  })

  it("evento atrasado (EXPIRED depois de CONFIRMED) é ignorado e o pagamento permanece", async () => {
    const { ledger, charges } = makeLedger()
    await ledger.record(input({ status: "CONFIRMED" }))

    const result = await ledger.record(input({ status: "EXPIRED" }))

    expect(result.ok && result.outcome).toBe("unchanged")
    expect(charges.charges[0].status).toBe("CONFIRMED")
  })
})
