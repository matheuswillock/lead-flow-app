import { createHmac } from "node:crypto"
import { describe, expect, it } from "bun:test"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import { PaymentProviderEventProcessor } from "@/lib/payment-provider/event-inbox"
import type { PaymentProviderEventInboxRepository } from "@/lib/payment-provider/event-inbox"
import { AbacatePayProvider } from "@/app/api/infra/providers/AbacatePayProvider"
import { PaymentProviderWebhookService } from "./PaymentProviderWebhookService"

class MemoryRepository implements PaymentProviderEventInboxRepository {
  private readonly hashes = new Map<string, string>()
  readonly sequence: string[] = []

  async claim(input: Parameters<PaymentProviderEventInboxRepository["claim"]>[0]) {
    this.sequence.push("claim")
    const current = this.hashes.get(input.dedupeKey)
    if (!current) {
      this.hashes.set(input.dedupeKey, input.payloadHash)
      return { kind: "claimed" as const }
    }
    return current === input.payloadHash ? { kind: "duplicate" as const } : { kind: "conflict" as const }
  }

  async markProcessed(): Promise<void> {}
  async markFailed(): Promise<void> {}
}

describe("PaymentProviderWebhookService", () => {
  it("verifies, normalizes and claims a webhook before applying its transition", async () => {
    const rawBody = JSON.stringify({
      id: "evt_service_1",
      event: "transparent.completed",
      devMode: true,
      data: { id: "pay_service_1", status: "PAID", method: "PIX", amount: 1250 },
    })
    const provider = new AbacatePayProvider(
      PaymentProviderConfig.create({
        apiKey: "sk_test_provider",
        publicKey: "pk_test_provider",
        webhookSecret: "webhook-secret",
        webhookSigningKey: "hmac-secret",
        environment: "DEV",
        devMode: true,
      }),
    )
    const repository = new MemoryRepository()
    const service = new PaymentProviderWebhookService({
      provider,
      providerKey: "ABACATE_PAY",
      environment: "DEV",
      eventProcessor: new PaymentProviderEventProcessor(repository),
      getCurrentStatus: async () => {
        repository.sequence.push("status")
        return "PENDING"
      },
      applyEvent: async () => {
        repository.sequence.push("apply")
      },
    })
    const signature = createHmac("sha256", "hmac-secret").update(rawBody).digest("base64")

    await expect(
      service.handle({
        externalAccountContext: "account_a",
        request: { rawBody, signature, query: { webhookSecret: "webhook-secret" } },
      }),
    ).resolves.toMatchObject({ action: "apply", nextStatus: "CONFIRMED" })
    expect(repository.sequence).toEqual(["claim", "status", "apply"])
  })
})
