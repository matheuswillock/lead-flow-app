import type { PaymentProviderEventInboxClaim } from "@/lib/payment-provider/event-inbox"
import type { InboxHealthSnapshot } from "@/lib/payment-provider/inbox-health"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export type PaymentProviderEventClaimInput = {
  readonly dedupeKey: string
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly eventId: string
  readonly payloadHash: string
  readonly payload: string
  readonly normalizedEvent?: string
  readonly tombstoneUntil: Date
  readonly now: Date
  readonly staleBefore: Date
}

export interface IPaymentProviderEventInboxRepository {
  /** Contagens somente-leitura para o alerta de saúde da inbox. */
  getHealthSnapshot(input: { readonly failedSince: Date }): Promise<InboxHealthSnapshot>
  claim(input: PaymentProviderEventClaimInput): Promise<PaymentProviderEventInboxClaim>
  assertClaimActive(input: {
    readonly dedupeKey: string
    readonly claimToken: string
    readonly now: Date
    readonly staleBefore: Date
  }): Promise<boolean>
  markProcessed(input: { readonly dedupeKey: string; readonly claimToken: string }): Promise<void>
  markFailed(input: { readonly dedupeKey: string; readonly claimToken: string; readonly message: string }): Promise<void>
}
