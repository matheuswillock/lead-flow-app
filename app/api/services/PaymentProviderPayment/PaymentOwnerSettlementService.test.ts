import { describe, expect, it, mock } from "bun:test"
import { PaymentOwnerSettlementService } from "./PaymentOwnerSettlementService"

const PAID_AT = new Date("2026-10-21T12:00:00.000Z")

function makeHarness(
  overrides: {
    adhesionPayment?: unknown
    gracePayment?: { status: string } | null
    expectedAmountInCents?: number | null
    applyResult?: { isValid: boolean; errorMessages: string[] }
  } = {},
) {
  const markPaidFromProvider = mock(async (_adhesionId: string, _input: unknown) => undefined)
  const findAdhesionPayment = mock(async (_id: string) =>
    "adhesionPayment" in overrides ? overrides.adhesionPayment : { id: "pay-1", adhesionId: "adh-1" },
  )
  const graseFind = mock(async (_id: string) => overrides.gracePayment ?? { id: "grace-1", status: "pending" })
  const markConfirmed = mock(async (_input: unknown) => ({ id: "grace-1", status: "confirmed" }))
  const completeAndRestoreAccess = mock(async (_id: string) => ({ id: "grace-1", status: "completed" }))
  const expectedAmountInCents = mock(async (_id: string) =>
    "expectedAmountInCents" in overrides ? overrides.expectedAmountInCents ?? null : 29990,
  )
  const applyById = mock(async (_id: string) => {
    const result = overrides.applyResult ?? { isValid: true, errorMessages: [] }
    return result as never
  })
  const service = new PaymentOwnerSettlementService({
    adhesionPayments: { findById: findAdhesionPayment } as never,
    adhesions: { markPaidFromProvider },
    gracePayments: { findById: graseFind, markConfirmed, completeAndRestoreAccess } as never,
    pendingActions: { expectedAmountInCents, applyById },
    backofficePayments: {
      expectedAmountInCents: mock(async () => null),
      isSettled: mock(async () => false),
      markPaid: mock(async () => undefined),
    },
  })
  return { service, markPaidFromProvider, markConfirmed, completeAndRestoreAccess, graseFind, expectedAmountInCents, applyById }
}

describe("PaymentOwnerSettlementService — PENDING_ACTION_ADDON", () => {
  const addOnEvent = {
    ownerType: "PENDING_ACTION_ADDON",
    ownerId: "pa-1",
    externalId: "bill_1",
    amountInCents: 29990,
    paidAt: PAID_AT,
  }

  it("aplica a ação quando o valor pago confere com a cobrança", async () => {
    const { service, applyById } = makeHarness()

    const result = await service.settleConfirmed(addOnEvent)

    expect(result).toBe("settled")
    expect(applyById).toHaveBeenCalledWith("pa-1")
  })

  it("recusa e não aplica quando o valor pago difere da cobrança", async () => {
    const { service, applyById } = makeHarness({ expectedAmountInCents: 10000 })

    await expect(service.settleConfirmed(addOnEvent)).rejects.toThrow("Valor pago não confere")
    expect(applyById).not.toHaveBeenCalled()
  })

  it("recusa e não aplica quando o provider não informa o valor", async () => {
    const { service, applyById } = makeHarness()

    await expect(service.settleConfirmed({ ...addOnEvent, amountInCents: null })).rejects.toThrow(
      "sem valor informado",
    )
    expect(applyById).not.toHaveBeenCalled()
  })

  it("recusa quando a ação pendente não existe", async () => {
    const { service, applyById } = makeHarness({ expectedAmountInCents: null })

    await expect(service.settleConfirmed(addOnEvent)).rejects.toThrow("Ação pendente não encontrada")
    expect(applyById).not.toHaveBeenCalled()
  })

  it("propaga a falha de aplicação para o webhook tentar de novo", async () => {
    const { service } = makeHarness({ applyResult: { isValid: false, errorMessages: ["Ação cancelada"] } })

    await expect(service.settleConfirmed(addOnEvent)).rejects.toThrow("Ação cancelada")
  })
})

describe("PaymentOwnerSettlementService", () => {
  it("BACKOFFICE_ADHESION: resolve a adesão pelo pagamento e aplica o efeito de domínio", async () => {
    const { service, markPaidFromProvider } = makeHarness()

    const result = await service.settleConfirmed({
      ownerType: "BACKOFFICE_ADHESION",
      ownerId: "pay-1",
      externalId: "pix_1",
      amountInCents: 29990,
      paidAt: PAID_AT,
    })

    expect(result).toBe("settled")
    expect(markPaidFromProvider).toHaveBeenCalledWith("adh-1", {
      paidAt: PAID_AT,
      providerPaymentId: "pix_1",
      adhesionPaymentId: "pay-1",
      amountInCents: 29990,
    })
  })

  it("BACKOFFICE_ADHESION: falha quando o pagamento não existe (não engole)", async () => {
    const { service, markPaidFromProvider } = makeHarness({ adhesionPayment: null })

    await expect(
      service.settleConfirmed({ ownerType: "BACKOFFICE_ADHESION", ownerId: "x", externalId: "pix_1", amountInCents: null, paidAt: PAID_AT }),
    ).rejects.toThrow("Pagamento da adesão não encontrado")
    expect(markPaidFromProvider).not.toHaveBeenCalled()
  })

  it("BILLING_GRACE_PAYMENT: confirma e restaura o acesso", async () => {
    const { service, markConfirmed, completeAndRestoreAccess } = makeHarness()

    await service.settleConfirmed({ ownerType: "BILLING_GRACE_PAYMENT", ownerId: "grace-1", externalId: "pix_2", amountInCents: null, paidAt: PAID_AT })

    expect(markConfirmed).toHaveBeenCalledWith({ id: "grace-1", providerExternalId: "pix_2", confirmedAt: PAID_AT })
    expect(completeAndRestoreAccess).toHaveBeenCalledWith("grace-1")
  })

  it("BILLING_GRACE_PAYMENT: regularização já concluída é no-op idempotente", async () => {
    const { service, markConfirmed, completeAndRestoreAccess } = makeHarness({ gracePayment: { status: "completed" } })

    const result = await service.settleConfirmed({ ownerType: "BILLING_GRACE_PAYMENT", ownerId: "grace-1", externalId: "pix_2", amountInCents: null, paidAt: PAID_AT })

    expect(result).toBe("settled")
    expect(markConfirmed).not.toHaveBeenCalled()
    expect(completeAndRestoreAccess).not.toHaveBeenCalled()
  })

  it("owner sem efeito de domínio neste serviço devolve unsupported", async () => {
    const { service } = makeHarness()
    expect(
      await service.settleConfirmed({ ownerType: "PLATFORM_PURCHASE", ownerId: "p", externalId: "e", amountInCents: null, paidAt: PAID_AT }),
    ).toBe("unsupported")
  })
})
