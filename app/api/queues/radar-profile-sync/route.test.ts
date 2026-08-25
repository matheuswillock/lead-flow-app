import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { RadarProfileSyncPayload } from "@/lib/queues/radar-profile-sync"

mock.module("@/lib/queues/radar-profile-sync", () => ({
  handleRadarProfileSyncCallback: (
    handler: (
      message: RadarProfileSyncPayload,
      metadata: { messageId: string; deliveryCount: number }
    ) => Promise<void>
  ) => handler,
  publishRadarProfileSync: mock(async () => ({ messageId: "mid-test" })),
  RADAR_PROFILE_SYNC_QUEUE_PUBLISH_FAILED_TAG: "radar_profile_sync_queue_publish_failed",
  RADAR_PROFILE_SYNC_TOPIC: "radar-profile-sync",
  RADAR_PROFILE_SYNC_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildRadarProfileSyncIdempotencyKey: () => "key",
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

const { processRadarProfileSyncMessage } = await import("./route")

const execute = mock(async () => new Output(true, [], [], { ok: true }))

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "radar-profile-sync",
  region: "gru1",
}

describe("processRadarProfileSyncMessage", () => {
  beforeEach(() => {
    execute.mockReset()
    execute.mockResolvedValue(new Output(true, [], [], { ok: true }))
  })

  it("chama o UseCase com o payload", async () => {
    const message: RadarProfileSyncPayload = {
      source: "crm",
      teamId: "team-1",
      sourceId: "lead-1",
    }
    await processRadarProfileSyncMessage(message, metadata, { execute })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(message)
  })

  it("payload inválido: ack sem chamar UseCase", async () => {
    await processRadarProfileSyncMessage(
      { source: "crm", teamId: "", sourceId: "lead-1" },
      metadata,
      { execute }
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("!isValid: lança para retry", async () => {
    execute.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processRadarProfileSyncMessage(
        { source: "crm", teamId: "team-1", sourceId: "lead-1" },
        metadata,
        { execute }
      )
    ).rejects.toThrow("falhou")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    execute.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processRadarProfileSyncMessage(
        { source: "crm", teamId: "team-1", sourceId: "lead-1" },
        { ...metadata, deliveryCount: 20 },
        { execute },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "radar-profile-sync",
        deliveryCount: 20,
      }),
    )
  })
})
