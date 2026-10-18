import type { RawWebhookRequest, WebhookCapability } from "@/lib/payment-provider/contracts"
import { PaymentProviderEventProcessor, type PaymentProviderEventProcessResult } from "@/lib/payment-provider/event-inbox"
import type { PaymentProviderEnvironment, PaymentProviderKey, PaymentAttemptStatus, ProviderWebhookEvent } from "@/lib/payment-provider/types"

export type PaymentProviderWebhookServiceDependencies = {
  readonly provider: WebhookCapability
  readonly providerKey: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly eventProcessor: PaymentProviderEventProcessor
  readonly getCurrentStatus: (externalPaymentId: string) => Promise<PaymentAttemptStatus>
  readonly applyEvent: (input: {
    readonly event: ProviderWebhookEvent
    readonly nextStatus: PaymentAttemptStatus
  }) => Promise<void>
}

/** Bridges transport verification to the durable inbox without exposing provider payloads to routes. */
export class PaymentProviderWebhookService {
  constructor(private readonly dependencies: PaymentProviderWebhookServiceDependencies) {}

  async handle(input: {
    readonly request: RawWebhookRequest
    readonly externalAccountContext: string
  }): Promise<PaymentProviderEventProcessResult | { readonly action: "ignored" }> {
    const verified = this.dependencies.provider.verifyRequest(input.request)
    const event = this.dependencies.provider.normalizeEvent(verified)
    if (!event) return { action: "ignored" }

    return this.dependencies.eventProcessor.process({
      provider: this.dependencies.providerKey,
      environment: this.dependencies.environment,
      externalAccountContext: input.externalAccountContext,
      rawBody: input.request.rawBody,
      event,
      getCurrentStatus: async (externalPaymentId) => this.dependencies.getCurrentStatus(externalPaymentId),
      apply: this.dependencies.applyEvent,
    })
  }
}
