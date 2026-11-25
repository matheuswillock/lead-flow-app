import type { IPaymentProviderSessionRepository } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import { paymentMethodFromFingerprint } from "@/lib/payment-provider/attempt-method"
import type { PaymentQueryCapability } from "@/lib/payment-provider/contracts"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import type { PaymentAttemptStatus, PaymentProviderEnvironment } from "@/lib/payment-provider/types"
import type { PaymentOwnerSettlement } from "./PaymentOwnerSettlementService"

export type PendingActionProviderPaymentTarget = {
  readonly id: string
  readonly providerAttemptId: string | null
}

export type PendingActionProviderPaymentResult =
  /** O provedor confirmou, o valor conferiu e a ação foi aplicada (ou já estava aplicada). */
  | { readonly outcome: "settled" }
  /** O provedor respondeu que a cobrança não está paga (pendente ou encerrada sem pagamento). */
  | { readonly outcome: "not_confirmed"; readonly status: PaymentAttemptStatus }
  /** Sem resposta conclusiva do provedor: nada foi aplicado. */
  | { readonly outcome: "indeterminate"; readonly message: string }
  /** O provedor confirmou, mas a liquidação recusou (ex.: valor divergente). */
  | { readonly outcome: "settlement_failed"; readonly message: string }

/** Confirma, consultando o provedor da própria ação, o pagamento de uma ação pendente de time. */
export interface PendingActionProviderPayment {
  settle(action: PendingActionProviderPaymentTarget): Promise<PendingActionProviderPaymentResult>
}

type QueryProviderResolver = (input: {
  readonly provider: string
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
}) => PaymentQueryCapability | Promise<PaymentQueryCapability>

export type PendingActionProviderPaymentDependencies = {
  readonly sessions: Pick<IPaymentProviderSessionRepository, "findAttemptById">
  readonly resolveQueryProvider: QueryProviderResolver
  readonly settlement: PaymentOwnerSettlement
  readonly now: () => Date
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "erro desconhecido")

export class PendingActionProviderPaymentService implements PendingActionProviderPayment {
  constructor(private readonly dependencies: PendingActionProviderPaymentDependencies) {}

  async settle(action: PendingActionProviderPaymentTarget): Promise<PendingActionProviderPaymentResult> {
    const { sessions, resolveQueryProvider, settlement, now } = this.dependencies
    if (!action.providerAttemptId) {
      return { outcome: "indeterminate", message: "Tentativa de pagamento não foi registrada" }
    }

    let remote
    let externalId: string
    try {
      const attempt = await sessions.findAttemptById(action.providerAttemptId)
      // A tentativa precisa pertencer a esta ação: o id vem da própria ação, mas o vínculo é conferido.
      if (
        !attempt?.externalId ||
        attempt.ownerType !== PAYMENT_PROVIDER_OWNER_TYPES.PENDING_ACTION_ADDON ||
        attempt.ownerId !== action.id
      ) {
        return { outcome: "indeterminate", message: "Tentativa de pagamento não encontrada" }
      }
      externalId = attempt.externalId
      const provider = await resolveQueryProvider({
        provider: attempt.provider,
        environment: attempt.environment,
        externalAccountContext: attempt.externalAccountContext,
      })
      remote = await provider.getStatus({
        externalId,
        method: paymentMethodFromFingerprint(attempt.requestFingerprint) ?? "PIX",
      })
    } catch (error) {
      console.error("[PendingActionProviderPaymentService][query] Error", {
        pendingActionId: action.id,
        message: errorMessage(error),
      })
      return { outcome: "indeterminate", message: "Não foi possível consultar o provedor de pagamento" }
    }

    if (remote.status === "UNKNOWN") {
      return { outcome: "indeterminate", message: "O provedor de pagamento não deu uma resposta conclusiva" }
    }
    if (remote.status !== "CONFIRMED") return { outcome: "not_confirmed", status: remote.status }

    try {
      await settlement.settleConfirmed({
        ownerType: PAYMENT_PROVIDER_OWNER_TYPES.PENDING_ACTION_ADDON,
        ownerId: action.id,
        externalId,
        amountInCents: remote.amountInCents,
        paidAt: now(),
      })
      return { outcome: "settled" }
    } catch (error) {
      return { outcome: "settlement_failed", message: errorMessage(error) }
    }
  }
}
