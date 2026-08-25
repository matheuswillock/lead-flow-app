import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { EmailCampaignDispatchWakePayload } from "@/lib/queues/email-campaign-dispatch"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

// Só o cliente da Vercel é stubado: `processDispatchMessage` usa o builder de
// idempotência de verdade, senão a chave assertada aqui divergiria em silêncio
// da que roda em produção.
mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = mock(async () => ({ messageId: "mid-test" }))
    handleCallback = (handler: unknown) => handler
  },
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

const { processEmailCampaignDispatchMessage } = await import("./processDispatchMessage")

const processDispatchQueueBatch = mock(async () => new Output(true, [], [], { hasMore: false }))

const baseMessage = (): EmailCampaignDispatchWakePayload => ({
  dispatchId: "dispatch-1",
  reason: "start",
})

const metadata: QueueMessageMetadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "email-campaign-dispatch",
  region: "gru1",
}

describe("processEmailCampaignDispatchMessage", () => {
  beforeEach(() => {
    processDispatchQueueBatch.mockReset()
    processDispatchQueueBatch.mockResolvedValue(new Output(true, [], [], { hasMore: false }))
  })

  it("chama processDispatchQueueBatch com o dispatchId", async () => {
    await processEmailCampaignDispatchMessage(baseMessage(), metadata, {
      processDispatchQueueBatch,
    })
    expect(processDispatchQueueBatch).toHaveBeenCalledWith("dispatch-1")
  })

  it("propaga erro para retry quando o use case lança", async () => {
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processEmailCampaignDispatchMessage(baseMessage(), metadata, {
        processDispatchQueueBatch,
      }),
    ).rejects.toThrow("P2024")
  })

  it("T-Q3.2 — payload inválido gera linha invalid_payload no outbox e acka", async () => {
    const ackDeadLetter = mock(async () => true)

    await expect(
      processEmailCampaignDispatchMessage(
        { reason: "start" } as EmailCampaignDispatchWakePayload,
        metadata,
        { processDispatchQueueBatch },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()

    expect(processDispatchQueueBatch).not.toHaveBeenCalled()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "email-campaign-dispatch",
        idempotencyKey: "invalid_payload:msg-1",
        maxDeliveryCount: 1,
        lastError: "invalid_payload: campos obrigatórios ausentes: dispatchId",
      }),
    )
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processEmailCampaignDispatchMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20 },
        { processDispatchQueueBatch },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "email-campaign-dispatch",
        idempotencyKey: "dispatch-1:start",
        deliveryCount: 20,
      }),
    )
  })

  it("overflow: dead-letter usa o tópico overflow", async () => {
    const ackDeadLetter = mock(async () => true)
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processEmailCampaignDispatchMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20, topicName: "email-campaign-dispatch-overflow" },
        { processDispatchQueueBatch },
        ackDeadLetter,
        "email-campaign-dispatch-overflow",
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "email-campaign-dispatch-overflow",
        deliveryCount: 20,
      }),
    )
  })
})
