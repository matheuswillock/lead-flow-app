import { describe, expect, it, mock } from "bun:test"
import { PaymentOwnerSettlementService } from "./PaymentOwnerSettlementService"

// Fase B: cobrança avulsa do backoffice (dono BACKOFFICE_PAYMENT) é baixada pelo webhook do AbacatePay.
const PAID_AT = new Date("2026-11-19T12:00:00.000Z")

function makeService(overrides: { expectedAmountInCents?: number | null; settled?: boolean } = {}) {
  const expectedAmountInCents = mock(async (_id: string) =>
    "expectedAmountInCents" in overrides ? (overrides.expectedAmountInCents ?? null) : 1000,
  )
  const isSettled = mock(async (_id: string) => overrides.settled ?? false)
  const markPaid = mock(async (_id: string) => undefined)
  const service = new PaymentOwnerSettlementService({
    adhesionPayments: { findById: mock(async () => null) } as never,
    adhesions: { markPaidFromProvider: mock(async () => undefined) },
    gracePayments: {
      findById: mock(async () => null),
      markConfirmed: mock(async () => null),
      completeAndRestoreAccess: mock(async () => null),
    } as never,
    pendingActions: {
      expectedAmountInCents: mock(async () => null),
      applyById: mock(async () => ({ isValid: true, errorMessages: [] })) as never,
    },
    backofficePayments: { expectedAmountInCents, isSettled, markPaid },
  })
  return { service, markPaid }
}

const event = {
  ownerType: "BACKOFFICE_PAYMENT",
  ownerId: "bp-1",
  externalId: "pix_char_1",
  amountInCents: 1000,
  paidAt: PAID_AT,
}

describe("PaymentOwnerSettlementService — BACKOFFICE_PAYMENT", () => {
  it("marca a cobrança avulsa como recebida quando o valor confere", async () => {
    const { service, markPaid } = makeService()

    expect(await service.settleConfirmed(event)).toBe("settled")
    expect(markPaid).toHaveBeenCalledWith("bp-1")
  })

  it("recusa e não baixa quando o valor pago difere da cobrança", async () => {
    const { service, markPaid } = makeService({ expectedAmountInCents: 2000 })

    await expect(service.settleConfirmed(event)).rejects.toThrow("Valor pago não confere")
    expect(markPaid).not.toHaveBeenCalled()
  })

  it("não repete a baixa quando a cobrança já está recebida", async () => {
    const { service, markPaid } = makeService({ settled: true })

    expect(await service.settleConfirmed(event)).toBe("settled")
    expect(markPaid).not.toHaveBeenCalled()
  })

  it("recusa cobrança avulsa inexistente", async () => {
    const { service, markPaid } = makeService({ expectedAmountInCents: null })

    await expect(service.settleConfirmed(event)).rejects.toThrow("Cobrança avulsa não encontrada")
    expect(markPaid).not.toHaveBeenCalled()
  })
})
