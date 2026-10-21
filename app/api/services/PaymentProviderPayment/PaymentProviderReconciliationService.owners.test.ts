import { describe, expect, it, mock } from "bun:test"
import type { StoredPaymentProviderAttemptRecord } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import { PaymentProviderReconciliationService } from "./PaymentProviderReconciliationService"

const lease = { leaseToken: "11111111-1111-1111-1111-111111111111", leaseUntil: new Date("2026-10-21T12:01:00.000Z"), fenceVersion: 1 }

function makeAttempt(ownerType: string): StoredPaymentProviderAttemptRecord {
  return {
    id: "attempt-1",
    sessionId: "session-1",
    attemptNumber: 1,
    idempotencyKey: "k",
    requestFingerprint: "f",
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    externalAccountContext: "ctx",
    tenantId: "adhesion-1",
    ownerType,
    ownerId: "owner-1",
    status: "UNKNOWN",
    externalId: "pix_1",
    reconciliationReference: null,
    unknownReason: "REMOTE_TIMEOUT",
    paymentInstructions: null,
    lease,
  }
}

function makeService(settleConfirmed: ReturnType<typeof mock>) {
  const updateAttemptWithLease = mock(async (input: { status: string }) => ({
    ...makeAttempt("BACKOFFICE_ADHESION"),
    status: input.status as never,
  }))
  const service = new PaymentProviderReconciliationService({
    sessions: {
      acquireAttemptLease: async () => makeAttempt("BACKOFFICE_ADHESION"),
      updateAttemptWithLease,
      releaseAttemptLease: async () => undefined,
    },
    identities: { bind: async () => undefined } as never,
    purchases: { markPaidOnceForProvider: async () => null },
    settlement: { settleConfirmed } as never,
    now: () => new Date("2026-10-21T12:00:00.000Z"),
  })
  const provider = { getStatus: async () => ({ status: "CONFIRMED" as const, externalId: "pix_1", method: "PIX" as const, amountInCents: 100, currency: "BRL" as const }) }
  return { service, provider, updateAttemptWithLease }
}

describe("PaymentProviderReconciliationService — owners sem compra", () => {
  it("aplica o efeito de domínio ANTES de fechar a tentativa UNKNOWN como CONFIRMED", async () => {
    const order: string[] = []
    const settleConfirmed = mock(async () => {
      order.push("settle")
      return "settled"
    })
    const { service, provider, updateAttemptWithLease } = makeService(settleConfirmed)
    updateAttemptWithLease.mockImplementation(async (input: { status: string }) => {
      order.push("transition")
      return { ...makeAttempt("BACKOFFICE_ADHESION"), status: input.status as never }
    })

    const result = await service.reconcile({ attempt: makeAttempt("BACKOFFICE_ADHESION"), method: "PIX", provider })

    expect(order).toEqual(["settle", "transition"])
    expect(result.purchaseStatus).toBe("paid")
    expect(settleConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ ownerType: "BACKOFFICE_ADHESION", ownerId: "owner-1", externalId: "pix_1" }),
    )
  })

  it("falha no efeito mantém a tentativa UNKNOWN para a próxima rodada do cron", async () => {
    const settleConfirmed = mock(async () => {
      throw new Error("Supabase Admin indisponível")
    })
    const { service, provider, updateAttemptWithLease } = makeService(settleConfirmed)

    await expect(
      service.reconcile({ attempt: makeAttempt("BACKOFFICE_ADHESION"), method: "PIX", provider }),
    ).rejects.toThrow("Supabase Admin indisponível")
    expect(updateAttemptWithLease).not.toHaveBeenCalled()
  })

  it("owner sem efeito neste serviço não chama o settlement", async () => {
    const settleConfirmed = mock(async () => "settled")
    const { service, provider } = makeService(settleConfirmed)

    await service.reconcile({ attempt: makeAttempt("OUTRO_OWNER"), method: "PIX", provider })

    expect(settleConfirmed).not.toHaveBeenCalled()
  })
})
