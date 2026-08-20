import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { RadarEngagementScoreUpdatePayload } from "@/lib/queues/radar-engagement-score-updates"

mock.module("@/lib/queues/radar-engagement-score-updates", () => ({
  handleRadarEngagementScoreUpdatesCallback: (
    handler: (
      message: RadarEngagementScoreUpdatePayload,
      metadata: QueueMessageMetadata
    ) => Promise<void>
  ) => handler,
  publishRadarEngagementScoreUpdate: mock(async () => ({ messageId: "mid-test" })),
  RADAR_ENGAGEMENT_SCORE_QUEUE_PUBLISH_FAILED_TAG:
    "radar_engagement_score_queue_publish_failed",
  RADAR_ENGAGEMENT_SCORE_UPDATES_TOPIC: "radar-engagement-score-updates",
  RADAR_ENGAGEMENT_SCORE_UPDATES_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildRadarEngagementScoreUpdateIdempotencyKey: (teamId: string, profileId: string) =>
    `${teamId}:${profileId}`,
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

const { processRadarEngagementScoreUpdateMessage } = await import("./route")

const updateEngagementScore = mock(
  async (_profileId: string, _teamId: string) =>
    ({ score: 10, band: "warm" }) as { score: number; band: "cold" | "warm" | "hot" }
)

const baseMessage = (): RadarEngagementScoreUpdatePayload => ({
  profileId: "11111111-1111-4111-8111-111111111111",
  teamId: "22222222-2222-4222-8222-222222222222",
})

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "radar-engagement-score-updates",
  region: "gru1",
}

describe("processRadarEngagementScoreUpdateMessage", () => {
  beforeEach(() => {
    updateEngagementScore.mockReset()
    updateEngagementScore.mockResolvedValue({ score: 10, band: "warm" })
  })

  it("chama updateEngagementScore com profileId e teamId", async () => {
    await processRadarEngagementScoreUpdateMessage(baseMessage(), metadata, {
      updateEngagementScore,
    })
    expect(updateEngagementScore).toHaveBeenCalledTimes(1)
    expect(updateEngagementScore).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    )
  })

  it("replay idempotente: segunda entrega chama updateEngagementScore de novo", async () => {
    await processRadarEngagementScoreUpdateMessage(baseMessage(), metadata, {
      updateEngagementScore,
    })
    await processRadarEngagementScoreUpdateMessage(
      baseMessage(),
      {
        ...metadata,
        messageId: "msg-2",
        deliveryCount: 2,
      },
      { updateEngagementScore }
    )
    expect(updateEngagementScore).toHaveBeenCalledTimes(2)
  })

  it("payload inválido: ack sem chamar updateEngagementScore", async () => {
    await processRadarEngagementScoreUpdateMessage(
      { ...baseMessage(), profileId: "" },
      metadata,
      { updateEngagementScore }
    )
    expect(updateEngagementScore).not.toHaveBeenCalled()
  })

  it("erro transitório: propaga throw para retry do handleCallback", async () => {
    updateEngagementScore.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processRadarEngagementScoreUpdateMessage(
        baseMessage(),
        {
          ...metadata,
          deliveryCount: 2,
        },
        { updateEngagementScore }
      )
    ).rejects.toThrow("P2024")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    updateEngagementScore.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processRadarEngagementScoreUpdateMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20 },
        { updateEngagementScore },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "radar-engagement-score-updates",
        deliveryCount: 20,
      }),
    )
  })
})
