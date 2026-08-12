import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishRadarEngagementScoreUpdate,
  buildRadarEngagementScoreUpdateIdempotencyKey,
  RADAR_ENGAGEMENT_SCORE_UPDATES_TOPIC,
  RADAR_ENGAGEMENT_SCORE_UPDATES_RETENTION_SECONDS,
} = await import("./radar-engagement-score-updates")

describe("publishRadarEngagementScoreUpdate", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com idempotencyKey teamId:profileId e retenção de 7 dias", async () => {
    const payload = {
      profileId: "11111111-1111-4111-8111-111111111111",
      teamId: "22222222-2222-4222-8222-222222222222",
    }
    const result = await publishRadarEngagementScoreUpdate(payload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(RADAR_ENGAGEMENT_SCORE_UPDATES_TOPIC)
    expect(call[1]).toEqual(payload)
    expect(call[2]).toEqual({
      idempotencyKey: "22222222-2222-4222-8222-222222222222:11111111-1111-4111-8111-111111111111",
      retentionSeconds: RADAR_ENGAGEMENT_SCORE_UPDATES_RETENTION_SECONDS,
    })
  })
})

describe("buildRadarEngagementScoreUpdateIdempotencyKey", () => {
  it("usa teamId:profileId", () => {
    expect(
      buildRadarEngagementScoreUpdateIdempotencyKey("team-a", "profile-b")
    ).toBe("team-a:profile-b")
  })
})
