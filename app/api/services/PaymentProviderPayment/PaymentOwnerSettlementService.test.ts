import { describe, expect, it, mock } from "bun:test"
import { PaymentOwnerSettlementService } from "./PaymentOwnerSettlementService"

const PAID_AT = new Date("2026-10-21T12:00:00.000Z")

function makeHarness(overrides: { adhesionPayment?: unknown; gracePayment?: { status: string } | null } = {}) {
  const markPaidFromProvider = mock(async (_adhesionId: string, _input: unknown) => undefined)
  const findAdhesionPayment = mock(async (_id: string) =>
    "adhesionPayment" in overrides ? overrides.adhesionPayment : { id: "pay-1", adhesionId: "adh-1" },
  )
  const graseFind = mock(async (_id: string) => overrides.gracePayment ?? { id: "grace-1", status: "pending" })
  const markConfirmed = mock(async (_input: unknown) => ({ id: "grace-1", status: "confirmed" }))
  const completeAndRestoreAccess = mock(async (_id: string) => ({ id: "grace-1", status: "completed" }))
  const service = new PaymentOwnerSettlementService({
    adhesionPayments: { findById: findAdhesionPayment } as never,
    adhesions: { markPaidFromProvider },
    gracePayments: { findById: graseFind, markConfirmed, completeAndRestoreAccess } as never,
  })
  return { service, markPaidFromProvider, markConfirmed, completeAndRestoreAccess, graseFind }
}

describe("PaymentOwnerSettlementService", () => {
  it("BACKOFFICE_ADHESION: resolve a adesão pelo pagamento e aplica o efeito de domínio", async () => {
    const { service, markPaidFromProvider } = makeHarness()

    const result = await service.settleConfirmed({
      ownerType: "BACKOFFICE_ADHESION",
      ownerId: "pay-1",
      externalId: "pix_1",
      paidAt: PAID_AT,
    })

    expect(result).toBe("settled")
    expect(markPaidFromProvider).toHaveBeenCalledWith("adh-1", {
      paidAt: PAID_AT,
      providerPaymentId: "pix_1",
      adhesionPaymentId: "pay-1",
    })
  })

  it("BACKOFFICE_ADHESION: falha quando o pagamento não existe (não engole)", async () => {
    const { service, markPaidFromProvider } = makeHarness({ adhesionPayment: null })

    await expect(
      service.settleConfirmed({ ownerType: "BACKOFFICE_ADHESION", ownerId: "x", externalId: "pix_1", paidAt: PAID_AT }),
    ).rejects.toThrow("Pagamento da adesão não encontrado")
    expect(markPaidFromProvider).not.toHaveBeenCalled()
  })

  it("BILLING_GRACE_PAYMENT: confirma e restaura o acesso", async () => {
    const { service, markConfirmed, completeAndRestoreAccess } = makeHarness()

    await service.settleConfirmed({ ownerType: "BILLING_GRACE_PAYMENT", ownerId: "grace-1", externalId: "pix_2", paidAt: PAID_AT })

    expect(markConfirmed).toHaveBeenCalledWith({ id: "grace-1", providerExternalId: "pix_2", confirmedAt: PAID_AT })
    expect(completeAndRestoreAccess).toHaveBeenCalledWith("grace-1")
  })

  it("BILLING_GRACE_PAYMENT: regularização já concluída é no-op idempotente", async () => {
    const { service, markConfirmed, completeAndRestoreAccess } = makeHarness({ gracePayment: { status: "completed" } })

    const result = await service.settleConfirmed({ ownerType: "BILLING_GRACE_PAYMENT", ownerId: "grace-1", externalId: "pix_2", paidAt: PAID_AT })

    expect(result).toBe("settled")
    expect(markConfirmed).not.toHaveBeenCalled()
    expect(completeAndRestoreAccess).not.toHaveBeenCalled()
  })

  it("owner sem efeito de domínio neste serviço devolve unsupported", async () => {
    const { service } = makeHarness()
    expect(
      await service.settleConfirmed({ ownerType: "PLATFORM_PURCHASE", ownerId: "p", externalId: "e", paidAt: PAID_AT }),
    ).toBe("unsupported")
  })
})
