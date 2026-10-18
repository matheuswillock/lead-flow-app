import type { PaymentProviderEventInboxClaim } from "@/lib/payment-provider/event-inbox"
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
  claim(input: PaymentProviderEventClaimInput): Promise<PaymentProviderEventInboxClaim>
  markProcessed(dedupeKey: string): Promise<void>
  markFailed(dedupeKey: string, message: string): Promise<void>
}
