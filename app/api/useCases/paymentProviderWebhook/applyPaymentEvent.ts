import type {
  IPaymentProviderSessionRepository,
  StoredPaymentProviderAttemptRecord,
} from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import type { IPaymentProviderIdentityRepository } from "@/app/api/infra/data/repositories/paymentProviderIdentity/IPaymentProviderIdentityRepository"
import type { PaymentOwnerSettlement } from "@/app/api/services/PaymentProviderPayment/PaymentOwnerSettlementService"
import type { PaymentQueryCapability } from "@/lib/payment-provider/contracts"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import type {
  PaymentAttemptStatus,
  PaymentProviderEnvironment,
  ProviderStatusResult,
  ProviderWebhookEvent,
} from "@/lib/payment-provider/types"
import type { PaymentDisputedReport } from "./reportPaymentDisputed"
import type { RejectedConfirmationReport } from "./reportRejectedConfirmation"
import type { UnknownOwnerAttempt } from "./reportUnknownOwnerType"

const PROVIDER = "ABACATE_PAY"

export type ApplyPaymentEventDependencies = {
  readonly provider: Pick<PaymentQueryCapability, "getStatus">
  readonly sessions: Pick<
    IPaymentProviderSessionRepository,
    "findAttemptByExternalId" | "findAttemptById" | "applyEventWithClaim"
  >
  readonly identities: Pick<IPaymentProviderIdentityRepository, "bind">
  readonly purchases: {
    markPaidOnceForProvider(input: {
      readonly id: string
      readonly provider: string
      readonly externalId: string
    }): Promise<unknown>
  }
  readonly settlement: PaymentOwnerSettlement
  readonly alerts: {
    readonly unknownOwnerType: (attempt: UnknownOwnerAttempt) => void
    readonly paymentDisputed: (report: PaymentDisputedReport) => void
    readonly confirmationRejected: (report: RejectedConfirmationReport) => void
  }
  readonly context: {
    readonly environment: PaymentProviderEnvironment
    readonly externalAccountContext: string
    readonly routeVersion: string
  }
  readonly now?: () => Date
}

export type ApplyPaymentEventInput = {
  readonly event: ProviderWebhookEvent
  readonly nextStatus: PaymentAttemptStatus
  /** The domain mutation must fence its transaction with this claim token. */
  readonly claimToken: string
}

type VerifiedPayment = { readonly amountInCents: number }

/**
 * Aplica um evento do provider à tentativa e ao owner. Sem chave pública o HMAC do webhook não
 * é verificável, então todo evento que confirma pagamento é reconsultado no provider com a nossa
 * API key antes de qualquer mutação: só `PAID` com o valor esperado passa.
 */
export function createApplyPaymentEvent(deps: ApplyPaymentEventDependencies) {
  return async function applyPaymentEvent(input: ApplyPaymentEventInput): Promise<void> {
    const { event, nextStatus, claimToken } = input
    const externalId = requireExternalId(event)
    const { attempt, byCorrelation } = await resolveAttempt(deps, event, externalId)

    // Reconsulta ANTES de qualquer escrita: evento forjado ou inconsistente não deixa rastro de domínio.
    const verified =
      nextStatus === "CONFIRMED" ? await verifyConfirmation(deps, event, attempt, externalId) : null

    // The fenced attempt transition (via claimToken) is the authority. Only after winning it
    // do we bind the identity and settle the owner, so a concurrent refund cannot leave the
    // owner paid while the attempt becomes REFUNDED.
    await deps.sessions.applyEventWithClaim({
      externalId,
      attemptId: byCorrelation ? attempt.id : undefined,
      provider: PROVIDER,
      environment: deps.context.environment,
      externalAccountContext: deps.context.externalAccountContext,
      expectedStatus: attempt.status,
      nextStatus,
      claimToken,
      now: new Date(),
    })

    await deps.identities.bind({
      provider: PROVIDER,
      environment: deps.context.environment,
      externalAccountContext: deps.context.externalAccountContext,
      externalId,
      identityType: "PAYMENT",
      ownerType: attempt.ownerType,
      ownerId: attempt.ownerId,
      tenantId: attempt.tenantId,
      route: "NEW_ROUTER",
      routeVersion: deps.context.routeVersion,
    })

    if (verified) await settleConfirmed(deps, attempt, externalId, verified)
    if (nextStatus === "DISPUTED") reportDispute(deps, event, attempt, externalId)
  }
}

function requireExternalId(event: ProviderWebhookEvent): string {
  if (!event.externalPaymentId) {
    throw new PaymentProviderError("WEBHOOK_INVALID", "Evento sem id da cobrança")
  }
  return event.externalPaymentId
}

async function resolveAttempt(
  deps: ApplyPaymentEventDependencies,
  event: ProviderWebhookEvent,
  externalId: string,
): Promise<{ attempt: StoredPaymentProviderAttemptRecord; byCorrelation: boolean }> {
  const { environment, externalAccountContext } = deps.context
  // Resolve the attempt by provider charge id, or fall back to the attempt-unique correlation
  // from the webhook metadata (indeterminate initiations that never received the charge id).
  const byId = await deps.sessions.findAttemptByExternalId({
    externalId,
    provider: PROVIDER,
    environment,
    externalAccountContext,
  })
  const byCorrelation = !byId && event.attemptId ? await deps.sessions.findAttemptById(event.attemptId) : null
  const attempt = byId ?? byCorrelation
  if (!attempt) throw new Error("Tentativa não encontrada para o evento")
  if (byCorrelation && !belongsToThisProvider(attempt, deps)) {
    throw new Error("Tentativa correlacionada não pertence a este provider")
  }
  return { attempt, byCorrelation: Boolean(byCorrelation) }
}

function belongsToThisProvider(
  attempt: StoredPaymentProviderAttemptRecord,
  deps: ApplyPaymentEventDependencies,
): boolean {
  return (
    attempt.provider === PROVIDER &&
    attempt.environment === deps.context.environment &&
    attempt.externalAccountContext === deps.context.externalAccountContext
  )
}

async function verifyConfirmation(
  deps: ApplyPaymentEventDependencies,
  event: ProviderWebhookEvent,
  attempt: StoredPaymentProviderAttemptRecord,
  externalId: string,
): Promise<VerifiedPayment> {
  const queried = await queryPayment(deps, event, externalId)
  if (queried.status === "PENDING" || queried.status === "CREATED" || queried.status === "UNKNOWN") {
    // Ainda não pago (ou consulta indeterminada): 5xx faz o provider reenviar; o claim volta a "failed".
    throw new PaymentProviderError(
      "REMOTE_REQUEST_FAILED",
      "Pagamento ainda não confirmado pelo provedor",
      true,
    )
  }
  if (queried.status !== "CONFIRMED") {
    throw rejectConfirmation(deps, event, attempt, externalId, queried, "STATUS_NOT_PAID")
  }
  if (queried.amountInCents === null) {
    throw new PaymentProviderError("REMOTE_REQUEST_FAILED", "Valor do pagamento não verificável", true)
  }
  // A tentativa guarda o valor só no provider; o valor consultado é a referência e o do evento é conferido contra ele.
  if (event.amountInCents !== null && event.amountInCents !== queried.amountInCents) {
    throw rejectConfirmation(deps, event, attempt, externalId, queried, "AMOUNT_MISMATCH")
  }
  return { amountInCents: queried.amountInCents }
}

async function queryPayment(
  deps: ApplyPaymentEventDependencies,
  event: ProviderWebhookEvent,
  externalId: string,
): Promise<ProviderStatusResult> {
  try {
    return await deps.provider.getStatus({ externalId, method: event.method ?? "PIX" })
  } catch (error) {
    // Id malformado nunca vira cobrança real: evento inválido, sem retry. Demais falhas são retentáveis.
    if (error instanceof PaymentProviderError && error.code === "VALIDATION_FAILED") {
      throw new PaymentProviderError("WEBHOOK_INVALID", "Id da cobrança inválido")
    }
    throw error
  }
}

function rejectConfirmation(
  deps: ApplyPaymentEventDependencies,
  event: ProviderWebhookEvent,
  attempt: StoredPaymentProviderAttemptRecord,
  externalId: string,
  queried: ProviderStatusResult,
  reason: RejectedConfirmationReport["reason"],
): PaymentProviderError {
  deps.alerts.confirmationRejected({
    eventId: event.eventId,
    externalPaymentId: externalId,
    attemptId: attempt.id,
    ownerType: attempt.ownerType,
    queriedStatus: queried.status,
    queriedAmountInCents: queried.amountInCents,
    eventAmountInCents: event.amountInCents,
    reason,
  })
  return new PaymentProviderError("WEBHOOK_INVALID", "Confirmação divergente da consulta ao provedor")
}

async function settleConfirmed(
  deps: ApplyPaymentEventDependencies,
  attempt: StoredPaymentProviderAttemptRecord,
  externalId: string,
  verified: VerifiedPayment,
): Promise<void> {
  if (attempt.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.PLATFORM_PURCHASE) {
    await deps.purchases.markPaidOnceForProvider({ id: attempt.ownerId, provider: PROVIDER, externalId })
    return
  }
  const settled = await deps.settlement.settleConfirmed({
    ownerType: attempt.ownerType,
    ownerId: attempt.ownerId,
    externalId,
    amountInCents: verified.amountInCents,
    paidAt: (deps.now ?? (() => new Date()))(),
  })
  // Pagamento confirmado sem efeito de domínio conhecido não pode passar em silêncio.
  if (settled === "unsupported") deps.alerts.unknownOwnerType(attempt)
}

function reportDispute(
  deps: ApplyPaymentEventDependencies,
  event: ProviderWebhookEvent,
  attempt: StoredPaymentProviderAttemptRecord,
  externalId: string,
): void {
  deps.alerts.paymentDisputed({
    eventId: event.eventId,
    externalPaymentId: externalId,
    attemptId: attempt.id,
    ownerType: attempt.ownerType,
    ownerId: attempt.ownerId,
    tenantId: attempt.tenantId,
  })
}
