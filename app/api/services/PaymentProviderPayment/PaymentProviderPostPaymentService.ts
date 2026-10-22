import type { FullRefundCapability } from "@/lib/payment-provider/contracts"
import type {
  IPaymentProviderSessionRepository,
  StoredPaymentProviderAttemptRecord,
} from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"

const POST_PAYMENT_LEASE_TTL_MS = 60 * 1000
const DISPUTED_REFUND_MESSAGE = "Pagamento em disputa não pode ser reembolsado automaticamente"

export type RefundPaymentInput = {
  readonly attempt: StoredPaymentProviderAttemptRecord
  readonly provider: FullRefundCapability
  readonly reason?: string
}

export type RefundedPayment = {
  readonly attemptId: string
  readonly externalId: string
  readonly status: "REFUNDED"
}

export class PaymentProviderPostPaymentService {
  constructor(
    private readonly sessions: Pick<
      IPaymentProviderSessionRepository,
      "acquireAttemptLease" | "updateAttemptWithLease" | "releaseAttemptLease"
    >,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async refund(input: RefundPaymentInput): Promise<RefundedPayment> {
    if (input.attempt.status === "REFUNDED") {
      if (!input.attempt.externalId) throw new Error("Pagamento reembolsado sem ID externo")
      return {
        attemptId: input.attempt.id,
        externalId: input.attempt.externalId,
        status: "REFUNDED",
      }
    }
    // Disputa é decisão humana (decisão 17): nunca reembolsa sozinho nem pela API.
    if (input.attempt.status === "DISPUTED") throw new Error(DISPUTED_REFUND_MESSAGE)
    if (input.attempt.status !== "CONFIRMED") {
      throw new Error("Somente pagamentos confirmados podem ser reembolsados")
    }
    if (!input.attempt.externalId) throw new Error("Pagamento sem ID externo")

    const leased = await this.sessions.acquireAttemptLease({
      attemptId: input.attempt.id,
      tenantId: input.attempt.tenantId,
      ownerType: input.attempt.ownerType,
      ownerId: input.attempt.ownerId,
      purpose: "POST_PAYMENT",
      now: this.now(),
      ttlMs: POST_PAYMENT_LEASE_TTL_MS,
    })
    let transitioned = false
    try {
      // A disputa pode ter chegado entre a leitura da tentativa e a lease.
      if (leased.status === "DISPUTED") throw new Error(DISPUTED_REFUND_MESSAGE)
      const refunded = await input.provider.refundFull({
        externalId: input.attempt.externalId,
        reason: normalizeRefundReason(input.reason),
      })
      const updated = await this.sessions.updateAttemptWithLease({
        attemptId: input.attempt.id,
        tenantId: input.attempt.tenantId,
        ownerType: input.attempt.ownerType,
        ownerId: input.attempt.ownerId,
        lease: leased.lease,
        now: this.now(),
        status: "REFUNDED",
        // The lease read the current row after the caller supplied `input.attempt`,
        // so a concurrent dispute/refund transition may have advanced the status in
        // between. Fence on the leased status the refund decision was made against.
        expectedStatus: leased.status,
        operation: "POST_PAYMENT",
        externalId: refunded.externalId,
      })
      transitioned = true
      return { attemptId: updated.id, externalId: refunded.externalId, status: "REFUNDED" }
    } finally {
      if (!transitioned)
        await releaseLeaseBestEffort(this.sessions, leased.id, leased.lease, this.now())
    }
  }
}

function normalizeRefundReason(reason: string | undefined): string | undefined {
  const normalized = reason?.trim()
  if (!normalized) return undefined
  if (normalized.length > 500) throw new Error("Motivo do refund excede o limite permitido")
  return normalized
}

async function releaseLeaseBestEffort(
  sessions: Pick<IPaymentProviderSessionRepository, "releaseAttemptLease">,
  attemptId: string,
  lease: StoredPaymentProviderAttemptRecord["lease"],
  now: Date,
): Promise<void> {
  try {
    await sessions.releaseAttemptLease({ attemptId, lease, now })
  } catch (error) {
    console.error("[PaymentProviderPostPaymentService][release] Error", {
      attemptId,
      message: error instanceof Error ? error.message : "unknown",
    })
  }
}
