import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishRadarProfileSync,
  buildRadarProfileSyncIdempotencyKey,
  RADAR_PROFILE_SYNC_TOPIC,
  RADAR_PROFILE_SYNC_RETENTION_SECONDS,
} = await import("./radar-profile-sync")

describe("publishRadarProfileSync", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com idempotencyKey teamId:source:sourceId", async () => {
    const payload = { source: "crm" as const, teamId: "team-1", sourceId: "lead-1" }
    const result = await publishRadarProfileSync(payload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(RADAR_PROFILE_SYNC_TOPIC)
    expect(call[1]).toEqual(payload)
    expect(call[2]).toEqual({
      idempotencyKey: "team-1:crm:lead-1",
      retentionSeconds: RADAR_PROFILE_SYNC_RETENTION_SECONDS,
    })
  })
})

describe("buildRadarProfileSyncIdempotencyKey", () => {
  it("usa sourceId para crm/portfolio/finalized", () => {
    expect(
      buildRadarProfileSyncIdempotencyKey({
        source: "portfolio",
        teamId: "team-1",
        sourceId: "port-9",
      })
    ).toBe("team-1:portfolio:port-9")
  })

  it("hasheia leadIds no batch finalized", () => {
    const a = buildRadarProfileSyncIdempotencyKey({
      source: "finalized",
      teamId: "team-1",
      leadIds: ["b", "a"],
    })
    const b = buildRadarProfileSyncIdempotencyKey({
      source: "finalized",
      teamId: "team-1",
      leadIds: ["a", "b"],
    })
    expect(a).toBe(b)
    expect(a.startsWith("team-1:finalized:")).toBe(true)
    expect(a).not.toContain("a,b")
  })
})
