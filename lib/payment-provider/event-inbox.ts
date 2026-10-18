import { PaymentProviderError } from "./errors"
import {
  applyProviderEventTransition,
  createProviderEventDedupeKey,
  hashProviderEventPayload,
  type ProviderEventDedupeInput,
} from "./event-processing"
import type { PaymentAttemptStatus, ProviderWebhookEvent } from "./types"

export type PaymentProviderEventInboxClaim =
  | { readonly kind: "claimed" }
  | { readonly kind: "duplicate" }
  | { readonly kind: "conflict" }

export interface PaymentProviderEventInboxRepository {
  claim(input: {
    readonly dedupeKey: string
    readonly provider: ProviderEventDedupeInput["provider"]
    readonly environment: ProviderEventDedupeInput["environment"]
    readonly externalAccountContext: string
    readonly eventId: string
    readonly payloadHash: string
    readonly payload: string
    readonly normalizedEvent: string
    readonly tombstoneUntil: Date
    readonly now: Date
    readonly staleBefore: Date
  }): Promise<PaymentProviderEventInboxClaim>
  markProcessed(dedupeKey: string): Promise<void>
  markFailed(dedupeKey: string, message: string): Promise<void>
}

export type PaymentProviderEventProcessResult =
  | { readonly action: "apply"; readonly nextStatus: PaymentAttemptStatus }
  | { readonly action: "ignore"; readonly nextStatus: PaymentAttemptStatus }
  | { readonly action: "reconcile"; readonly nextStatus: "UNKNOWN" }
  | { readonly action: "duplicate" }

export class PaymentProviderEventProcessor {
  constructor(
    private readonly repository: PaymentProviderEventInboxRepository,
    private readonly options: {
      readonly now?: () => Date
      readonly processingLeaseMs?: number
    } = {},
  ) {}

  async process(input: {
    readonly provider: ProviderEventDedupeInput["provider"]
    readonly environment: ProviderEventDedupeInput["environment"]
    readonly externalAccountContext: string
    readonly rawBody: string
    readonly event: ProviderWebhookEvent
    readonly currentStatus?: PaymentAttemptStatus
    readonly getCurrentStatus?: (externalPaymentId: string) => Promise<PaymentAttemptStatus>
    readonly apply: (transition: {
      readonly event: ProviderWebhookEvent
      readonly nextStatus: PaymentAttemptStatus
    }) => Promise<void>
  }): Promise<PaymentProviderEventProcessResult> {
    const now = this.options.now?.() ?? new Date()
    const dedupeKey = createProviderEventDedupeKey({
      provider: input.provider,
      environment: input.environment,
      externalAccountContext: input.externalAccountContext,
      eventId: input.event.eventId,
    })
    const claim = await this.repository.claim({
      dedupeKey,
      provider: input.provider,
      environment: input.environment,
      externalAccountContext: input.externalAccountContext,
      eventId: input.event.eventId,
      payloadHash: hashProviderEventPayload(input.rawBody),
      payload: input.rawBody,
      normalizedEvent: input.event.event,
      tombstoneUntil: fiveYearsFromNow(now),
      now,
      staleBefore: new Date(now.getTime() - (this.options.processingLeaseMs ?? 10 * 60 * 1000)),
    })

    if (claim.kind === "duplicate") return { action: "duplicate" }
    if (claim.kind === "conflict") {
      throw new PaymentProviderError("WEBHOOK_INVALID", "Conflito de payload para o mesmo evento")
    }

    const currentStatus = input.getCurrentStatus
      ? input.event.externalPaymentId
        ? await input.getCurrentStatus(input.event.externalPaymentId)
        : "UNKNOWN"
      : input.currentStatus ?? "UNKNOWN"
    const transition = applyProviderEventTransition({
      currentStatus,
      event: input.event.event,
    })
    let applied = false
    try {
      if (transition.action === "apply") {
        await input.apply({ event: input.event, nextStatus: transition.nextStatus })
        applied = true
      }
      await this.repository.markProcessed(dedupeKey)
      return transition
    } catch (error) {
      if (!applied) {
        const message = error instanceof Error ? error.message : "Falha ao processar evento"
        await this.repository.markFailed(dedupeKey, message)
      }
      throw error
    }
  }
}

function fiveYearsFromNow(now: Date): Date {
  const date = new Date(now)
  date.setUTCFullYear(date.getUTCFullYear() + 5)
  return date
}
