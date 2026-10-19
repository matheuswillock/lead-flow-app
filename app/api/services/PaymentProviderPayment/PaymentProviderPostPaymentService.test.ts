import { describe, expect, it, mock } from "bun:test"
import type { FullRefundCapability } from "@/lib/payment-provider/contracts"
import type { StoredPaymentProviderAttemptRecord } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import { PaymentProviderPostPaymentService } from "./PaymentProviderPostPaymentService"

const attempt: StoredPaymentProviderAttemptRecord = {
  id: "attempt-1",
  sessionId: "session-1",
  attemptNumber: 1,
  idempotencyKey: "idempotency-1",
  requestFingerprint: "fingerprint-1",
  provider: "ABACATE_PAY",
  environment: "DEV",
  externalAccountContext: "abacate-dev",
  tenantId: "profile-1",
  ownerType: "PLATFORM_PURCHASE",
  ownerId: "purchase-1",
  status: "CONFIRMED",
  externalId: "abacate-payment-1",
  unknownReason: null,
  lease: { leaseToken: null, leaseUntil: null, fenceVersion: 0 },
}

const provider: FullRefundCapability = {
  refundFull: mock(async () => ({ externalId: "abacate-payment-1", status: "REFUNDED" as const })),
}

describe("PaymentProviderPostPaymentService", () => {
  it("libera a lease quando o provider falha", async () => {
    const releaseAttemptLease = mock(async () => undefined)
    const service = new PaymentProviderPostPaymentService({
      acquireAttemptLease: async () => ({
        ...attempt,
        lease: {
          leaseToken: "11111111-1111-1111-1111-111111111111",
          leaseUntil: new Date("2026-10-18T12:01:00.000Z"),
          fenceVersion: 1,
        },
      }),
      updateAttemptWithLease: async () => {
        throw new Error("não deveria atualizar")
      },
      releaseAttemptLease,
    })
    const failingProvider: FullRefundCapability = {
      refundFull: async () => {
        throw new Error("provider indisponível")
      },
    }

    await expect(service.refund({ attempt, provider: failingProvider })).rejects.toThrow(
      "provider indisponível",
    )
    expect(releaseAttemptLease).toHaveBeenCalledTimes(1)
  })

  it("trata uma tentativa já REFUNDED como operação idempotente", async () => {
    const refundFull = mock(provider.refundFull)
    const service = new PaymentProviderPostPaymentService({
      acquireAttemptLease: async () => {
        throw new Error("não deveria adquirir lease")
      },
      updateAttemptWithLease: async () => {
        throw new Error("não deveria atualizar")
      },
      releaseAttemptLease: async () => undefined,
    })

    const result = await service.refund({
      attempt: { ...attempt, status: "REFUNDED" },
      provider: { refundFull },
    })

    expect(result).toEqual({
      attemptId: "attempt-1",
      externalId: "abacate-payment-1",
      status: "REFUNDED",
    })
    expect(refundFull).not.toHaveBeenCalled()
  })
})
