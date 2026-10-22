import { describe, expect, it, mock } from "bun:test"
import { InMemoryPaymentChargeRepository } from "@/test/support/in-memory-payment-charge-repository"
import { ChargeLedger } from "./ChargeLedger"
import { OwnerChargeMirror, type OwnerChargeSnapshot } from "./OwnerChargeMirror"

const PAID_AT = new Date("2026-10-21T12:00:00.000Z")

const snapshot: OwnerChargeSnapshot = {
  profileId: "profile-1",
  purpose: "ADHESION",
  purposeRefId: "pay-1",
  status: "COMPLETED",
  amountCents: 29990,
  method: "PIX",
}

const attempt = {
  id: "attempt-1",
  sessionId: "session-1",
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  externalAccountContext: "primary",
  paymentInstructions: null,
}

function makeMirror(overrides: { snapshot?: OwnerChargeSnapshot | null; throwOnSnapshot?: boolean } = {}) {
  const charges = new InMemoryPaymentChargeRepository()
  const logError = mock((_m: string, _c: Record<string, unknown>) => undefined)
  const ledger = new ChargeLedger({ charges, now: () => PAID_AT, logError })
  const mirror = new OwnerChargeMirror({
    ledger,
    logError,
    source: {
      snapshot: async () => {
        if (overrides.throwOnSnapshot) throw new Error("db caiu")
        return "snapshot" in overrides ? (overrides.snapshot ?? null) : snapshot
      },
    },
    attempts: { findLatestAttemptByOwner: async () => attempt as never },
  })
  return { mirror, charges, logError }
}

const input = {
  ownerType: "BACKOFFICE_ADHESION",
  ownerId: "pay-1",
  externalId: "pix_1",
  paidAt: PAID_AT,
}

describe("OwnerChargeMirror.mirrorSettled", () => {
  it("espelha o dono no ledger com source=MIRROR, ids da tentativa e valor do dono", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorSettled(input)

    expect(charges.charges).toHaveLength(1)
    expect(charges.charges[0]).toMatchObject({
      source: "MIRROR",
      purpose: "ADHESION",
      status: "COMPLETED",
      amountCents: 29990,
      provider: "ABACATE_PAY",
      providerContext: "primary",
      providerExternalId: "pix_1",
      providerAttemptId: "attempt-1",
      providerSessionId: "session-1",
      idempotencyKey: "mirror:BACKOFFICE_ADHESION:pay-1",
    })
  })

  it("repetir o espelho não duplica a cobrança", async () => {
    const { mirror, charges } = makeMirror()

    await mirror.mirrorSettled(input)
    await mirror.mirrorSettled(input)

    expect(charges.charges).toHaveLength(1)
  })

  it("nunca lança: falha ao ler o dono só gera log", async () => {
    const { mirror, charges, logError } = makeMirror({ throwOnSnapshot: true })

    await expect(mirror.mirrorSettled(input)).resolves.toBeUndefined()
    expect(charges.charges).toHaveLength(0)
    expect(logError).toHaveBeenCalled()
  })

  it("dono sem snapshot (conta ainda não criada) é ignorado sem erro", async () => {
    const { mirror, charges } = makeMirror({ snapshot: null })

    await expect(mirror.mirrorSettled(input)).resolves.toBeUndefined()
    expect(charges.charges).toHaveLength(0)
  })
})

describe("OwnerChargeMirror.mirrorStatus (estados terminais não pagos)", () => {
  const refundInput = { ownerType: "PLATFORM_PURCHASE", ownerId: "pay-1", externalId: "pix_1" }

  it("reembolso depois do pagamento leva a cobrança espelhada para REFUNDED sem mexer no paidAt", async () => {
    const { mirror, charges } = makeMirror()
    await mirror.mirrorSettled(input)

    await mirror.mirrorStatus({ ...refundInput, status: "REFUNDED" })

    expect(charges.charges).toHaveLength(1)
    expect(charges.charges[0].status).toBe("REFUNDED")
    expect(charges.charges[0].paidAt).toEqual(PAID_AT)
  })

  it("disputa leva a cobrança para REVIEW", async () => {
    const { mirror, charges } = makeMirror()
    await mirror.mirrorSettled(input)

    await mirror.mirrorStatus({ ...refundInput, status: "REVIEW" })

    expect(charges.charges[0].status).toBe("REVIEW")
  })

  it("nunca lança: falha ao ler o dono só gera log", async () => {
    const { mirror, logError } = makeMirror({ throwOnSnapshot: true })

    await expect(mirror.mirrorStatus({ ...refundInput, status: "REFUNDED" })).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalled()
  })
})
