import { describe, expect, it, mock } from "bun:test"
import type { StoredPaymentProviderAttemptRecord } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import { PaymentProviderRefundUseCase } from "@/app/api/useCases/paymentProviderPayment/PaymentProviderRefundUseCase"
import { PaymentProviderPostPaymentService } from "./PaymentProviderPostPaymentService"

const disputed: StoredPaymentProviderAttemptRecord = {
  id: "attempt-1",
  sessionId: "session-1",
  attemptNumber: 1,
  idempotencyKey: "idempotency-1",
  requestFingerprint: "fingerprint-1",
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  externalAccountContext: "abacate-production",
  tenantId: "profile-1",
  ownerType: "PLATFORM_PURCHASE",
  ownerId: "purchase-1",
  status: "DISPUTED",
  externalId: "pix_char_1",
  reconciliationReference: null,
  unknownReason: null,
  paymentInstructions: null,
  lease: { leaseToken: null, leaseUntil: null, fenceVersion: 0 },
}

const refundFull = mock(async () => ({ externalId: "pix_char_1", status: "REFUNDED" as const }))
const acquireAttemptLease = mock(async () => disputed)
const sessions = {
  acquireAttemptLease,
  updateAttemptWithLease: mock(async () => disputed),
  releaseAttemptLease: mock(async () => undefined),
}

describe("reembolso de tentativa DISPUTED (PAY-HARD-T019)", () => {
  it("o serviço rejeita reembolsar uma tentativa em disputa, sem chamar o provider", async () => {
    refundFull.mockClear()
    const service = new PaymentProviderPostPaymentService(sessions)

    await expect(service.refund({ attempt: disputed, provider: { refundFull } })).rejects.toThrow(/disputa/i)
    expect(refundFull).not.toHaveBeenCalled()
  })

  it("rejeita também quando a disputa chega entre a leitura e a lease", async () => {
    refundFull.mockClear()
    acquireAttemptLease.mockImplementationOnce(async () => ({ ...disputed, status: "DISPUTED" }))
    const service = new PaymentProviderPostPaymentService(sessions)

    await expect(
      service.refund({ attempt: { ...disputed, status: "CONFIRMED" }, provider: { refundFull } }),
    ).rejects.toThrow(/disputa/i)
    expect(refundFull).not.toHaveBeenCalled()
  })

  it("a API (use case) responde inválido para DISPUTED e não reembolsa", async () => {
    refundFull.mockClear()
    const consoleError = (await import("bun:test")).spyOn(console, "error").mockImplementation(() => undefined)
    const useCase = new PaymentProviderRefundUseCase({
      sessions: { findAttemptById: async () => disputed },
      refundService: new PaymentProviderPostPaymentService(sessions),
      resolveProvider: () => ({ refundFull }),
    })

    const output = await useCase.execute({ attemptId: "attempt-1" })

    expect(output.isValid).toBe(false)
    expect(refundFull).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("tentativa CONFIRMED continua reembolsável", async () => {
    refundFull.mockClear()
    acquireAttemptLease.mockImplementationOnce(async () => ({ ...disputed, status: "CONFIRMED" }))
    const service = new PaymentProviderPostPaymentService({
      ...sessions,
      updateAttemptWithLease: mock(async () => ({ ...disputed, status: "REFUNDED" as const })),
    })

    const result = await service.refund({ attempt: { ...disputed, status: "CONFIRMED" }, provider: { refundFull } })

    expect(result.status).toBe("REFUNDED")
    expect(refundFull).toHaveBeenCalledTimes(1)
  })
})
