import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { BackofficeEmailCampaignDispatchWakePayload } from "@/lib/queues/backoffice-email-campaign-dispatch"

mock.module("@/lib/queues/backoffice-email-campaign-dispatch", () => ({
  handleBackofficeEmailCampaignDispatchCallback: (
    handler: (
      message: BackofficeEmailCampaignDispatchWakePayload,
      metadata: QueueMessageMetadata
    ) => Promise<void>
  ) => handler,
  publishBackofficeEmailCampaignDispatchWake: mock(async () => ({ messageId: "mid-test" })),
  BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC: "backoffice-email-campaign-dispatch",
  BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildBackofficeEmailCampaignDispatchIdempotencyKey: (
    payload: BackofficeEmailCampaignDispatchWakePayload,
  ) => `${payload.dispatchId}:${payload.reason}`,
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

const { processBackofficeEmailCampaignDispatchMessage } = await import("./route")

const processDispatchQueueBatch = mock(async () => new Output(true, [], [], { hasMore: false }))

const baseMessage = (): BackofficeEmailCampaignDispatchWakePayload => ({
  dispatchId: "dispatch-1",
  reason: "start",
})

const metadata: QueueMessageMetadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "backoffice-email-campaign-dispatch",
  region: "gru1",
}

describe("processBackofficeEmailCampaignDispatchMessage", () => {
  beforeEach(() => {
    processDispatchQueueBatch.mockReset()
    processDispatchQueueBatch.mockResolvedValue(new Output(true, [], [], { hasMore: false }))
  })

  it("chama processDispatchQueueBatch com o dispatchId da mensagem", async () => {
    await processBackofficeEmailCampaignDispatchMessage(baseMessage(), metadata, {
      processDispatchQueueBatch,
    })

    expect(processDispatchQueueBatch).toHaveBeenCalledTimes(1)
    expect(processDispatchQueueBatch).toHaveBeenCalledWith("dispatch-1")
  })

  it("mensagem sem dispatchId: acka sem chamar o use case", async () => {
    await processBackofficeEmailCampaignDispatchMessage(
      { reason: "start" } as BackofficeEmailCampaignDispatchWakePayload,
      metadata,
      { processDispatchQueueBatch }
    )

    expect(processDispatchQueueBatch).not.toHaveBeenCalled()
  })

  it("propaga erro para retry do handleCallback quando o use case lança", async () => {
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))

    await expect(
      processBackofficeEmailCampaignDispatchMessage(baseMessage(), metadata, {
        processDispatchQueueBatch,
      })
    ).rejects.toThrow("P2024")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    processDispatchQueueBatch.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processBackofficeEmailCampaignDispatchMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20 },
        { processDispatchQueueBatch },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "backoffice-email-campaign-dispatch",
        idempotencyKey: "dispatch-1:start",
        deliveryCount: 20,
      }),
    )
  })

  it("não lança quando o use case retorna isValid=false (resultado apenas logado)", async () => {
    processDispatchQueueBatch.mockResolvedValueOnce(
      new Output(false, [], ["Campanha não encontrada para o disparo"], { hasMore: false })
    )

    await expect(
      processBackofficeEmailCampaignDispatchMessage(baseMessage(), metadata, {
        processDispatchQueueBatch,
      })
    ).resolves.toBeUndefined()
  })
})
