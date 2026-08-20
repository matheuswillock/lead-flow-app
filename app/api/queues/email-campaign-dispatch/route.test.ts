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

mock.module("@/lib/queues/email-campaign-dispatch", () => ({
  handleEmailCampaignDispatchCallback: (
    handler: (
      message: EmailCampaignDispatchWakePayload,
      metadata: QueueMessageMetadata,
    ) => Promise<void>,
  ) => handler,
  publishEmailCampaignDispatchWake: mock(async () => ({ messageId: "mid-test" })),
  EMAIL_CAMPAIGN_DISPATCH_TOPIC: "email-campaign-dispatch",
  EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildEmailCampaignDispatchIdempotencyKey: (payload: EmailCampaignDispatchWakePayload) =>
    `${payload.dispatchId}:${payload.reason}`,
}))

mock.module("@/app/api/useCases/email/EmailCampaignUseCase", () => ({
  EmailCampaignUseCase: class EmailCampaignUseCase {},
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

const { processEmailCampaignDispatchMessage } = await import("./route")

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
})
