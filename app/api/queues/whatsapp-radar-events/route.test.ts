import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { WhatsappRadarEventPayload } from "@/lib/queues/whatsapp-radar-events"

mock.module("@/lib/queues/whatsapp-radar-events", () => ({
  handleWhatsappRadarEventsCallback: (
    handler: (
      message: WhatsappRadarEventPayload,
      metadata: { messageId: string; deliveryCount: number }
    ) => Promise<void>
  ) => handler,
  publishWhatsappRadarEvent: mock(async () => ({ messageId: "mid-test" })),
  WHATSAPP_RADAR_EVENTS_QUEUE_PUBLISH_FAILED_TAG: "whatsapp_radar_events_queue_publish_failed",
  WHATSAPP_RADAR_EVENTS_TOPIC: "whatsapp-radar-events",
  WHATSAPP_RADAR_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildWhatsappRadarEventIdempotencyKey: () => "key",
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

const { processWhatsappRadarEventMessage } = await import("./route")

const execute = mock(async () => new Output(true, [], [], { ok: true }))

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "whatsapp-radar-events",
  region: "gru1",
}

describe("processWhatsappRadarEventMessage", () => {
  beforeEach(() => {
    execute.mockReset()
    execute.mockResolvedValue(new Output(true, [], [], { ok: true }))
  })

  it("chama o UseCase com payload de mensagem", async () => {
    const message: WhatsappRadarEventPayload = {
      source: "message",
      teamId: "team-1",
      messageId: "wa-1",
    }
    await processWhatsappRadarEventMessage(message, metadata, { execute })
    expect(execute).toHaveBeenCalledWith(message)
  })

  it("payload inválido: ack sem chamar UseCase", async () => {
    await processWhatsappRadarEventMessage(
      { source: "message", teamId: "", messageId: "wa-1" },
      metadata,
      { execute }
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("!isValid: lança para retry", async () => {
    execute.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processWhatsappRadarEventMessage(
        { source: "history", teamId: "team-1", since: "2026-07-15T00:00:00.000Z" },
        metadata,
        { execute }
      )
    ).rejects.toThrow("falhou")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    execute.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processWhatsappRadarEventMessage(
        { source: "message", teamId: "team-1", messageId: "wa-1" },
        { ...metadata, deliveryCount: 20 },
        { execute },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "whatsapp-radar-events",
        deliveryCount: 20,
      }),
    )
  })
})
