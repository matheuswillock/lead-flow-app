import { describe, expect, it, mock } from "bun:test"
import { InMemoryPaymentChargeRepository } from "@/test/support/in-memory-payment-charge-repository"
import { ChargeLedger, type RecordChargeInput } from "./ChargeLedger"
import { ChargeRefundService } from "./ChargeRefundService"
import { createChargeReversalHandlers, type ChargeReversalHandlers } from "./chargeReversalHandlers"

async function setup(options: {
  purpose?: RecordChargeInput["purpose"]
  status?: RecordChargeInput["status"]
  attemptStatus?: string
  handlers?: ChargeReversalHandlers
  providerAttemptId?: string | null
} = {}) {
  const charges = new InMemoryPaymentChargeRepository()
  const ledger = new ChargeLedger({ charges, logError: () => undefined })
  await ledger.record({
    profileId: "profile-1",
    purpose: options.purpose ?? "ADHESION",
    purposeRefId: "ref-1",
    status: options.status ?? "COMPLETED",
    amountCents: 1000,
    provider: "ABACATE_PAY",
    providerEnvironment: "PRODUCTION",
    providerContext: "primary",
    providerExternalId: "pix_1",
    providerAttemptId: options.providerAttemptId === undefined ? "attempt-1" : (options.providerAttemptId ?? undefined),
    idempotencyKey: "k",
    source: "ROUTER",
  })
  const refund = mock(async (_input: unknown) => ({ attemptId: "attempt-1", externalId: "pix_1", status: "REFUNDED" as const }))
  const provider = { refundFull: async () => ({ externalId: "pix_1" }) }
  const service = new ChargeRefundService({
    charges,
    ledger,
    attempts: { findAttemptById: async () => ({ id: "attempt-1", status: options.attemptStatus ?? "CONFIRMED" }) as never },
    refunder: { refund },
    resolveProvider: () => provider as never,
    reversals: options.handlers ?? createChargeReversalHandlers(),
  })
  return { service, charges, refund }
}

describe("ChargeRefundService", () => {
  it("delega ao PaymentProviderPostPaymentService, reverte pelo handler e marca REFUNDED", async () => {
    const reverse = mock(async (_charge: unknown) => undefined)
    const { service, charges, refund } = await setup({ handlers: { ADHESION: { reverse } } })

    const result = await service.refund({ chargeId: "charge-1", reason: "pedido do cliente", actor: "backoffice:1" })

    expect(result).toEqual({ chargeId: "charge-1", status: "REFUNDED" })
    expect(refund).toHaveBeenCalledTimes(1)
    expect(reverse).toHaveBeenCalledTimes(1)
    expect(charges.charges[0].status).toBe("REFUNDED")
    expect(charges.events.at(-1)).toMatchObject({ toStatus: "REFUNDED", actor: "backoffice:1" })
  })

  it("finalidade sem handler de reversão é recusada ANTES de devolver o dinheiro", async () => {
    const { service, refund, charges } = await setup({ purpose: "CREDITS" })

    await expect(service.refund({ chargeId: "charge-1", actor: "a" })).rejects.toThrow("Reversão não implementada")
    expect(refund).not.toHaveBeenCalled()
    expect(charges.charges[0].status).toBe("COMPLETED")
  })

  it("disputa fica fora: tentativa DISPUTED ou cobrança em REVIEW nunca é reembolsada (decisão 17)", async () => {
    const disputed = await setup({ attemptStatus: "DISPUTED" })
    await expect(disputed.service.refund({ chargeId: "charge-1", actor: "a" })).rejects.toThrow("disputa")
    expect(disputed.refund).not.toHaveBeenCalled()

    const review = await setup({ status: "REVIEW" })
    await expect(review.service.refund({ chargeId: "charge-1", actor: "a" })).rejects.toThrow()
    expect(review.refund).not.toHaveBeenCalled()
  })

  it("cobrança pendente ou sem tentativa não é reembolsável", async () => {
    const pending = await setup({ status: "PENDING" })
    await expect(pending.service.refund({ chargeId: "charge-1", actor: "a" })).rejects.toThrow("confirmadas")

    const noAttempt = await setup({ providerAttemptId: null })
    await expect(noAttempt.service.refund({ chargeId: "charge-1", actor: "a" })).rejects.toThrow("tentativa")
  })

  it("já reembolsada: não devolve de novo, mas repete a reversão (idempotente após falha parcial)", async () => {
    const reverse = mock(async (_charge: unknown) => undefined)
    const { service, refund } = await setup({ handlers: { ADHESION: { reverse } } })
    await service.refund({ chargeId: "charge-1", actor: "a" })

    await service.refund({ chargeId: "charge-1", actor: "a" })

    expect(refund).toHaveBeenCalledTimes(1)
    expect(reverse).toHaveBeenCalledTimes(2)
  })

  it("falha na reversão após o reembolso propaga e deixa a cobrança REFUNDED para nova tentativa", async () => {
    const { service, charges } = await setup({
      handlers: { ADHESION: { reverse: async () => { throw new Error("reversão falhou") } } },
    })

    await expect(service.refund({ chargeId: "charge-1", actor: "a" })).rejects.toThrow("reversão falhou")
    expect(charges.charges[0].status).toBe("REFUNDED")
  })

  it("cobrança inexistente lança", async () => {
    const { service } = await setup()
    await expect(service.refund({ chargeId: "nope", actor: "a" })).rejects.toThrow("Cobrança não encontrada")
  })
})
