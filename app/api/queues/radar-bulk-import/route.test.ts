import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { RadarBulkImportPayload } from "@/lib/queues/radar-bulk-import"

mock.module("@/lib/queues/radar-bulk-import", () => ({
  handleRadarBulkImportCallback: (
    handler: (
      message: RadarBulkImportPayload,
      metadata: { messageId: string; deliveryCount: number }
    ) => Promise<void>
  ) => handler,
  publishRadarBulkImportBatch: mock(async () => ({ messageId: "mid-test" })),
  RADAR_BULK_IMPORT_QUEUE_PUBLISH_FAILED_TAG: "radar_bulk_import_queue_publish_failed",
  RADAR_BULK_IMPORT_TOPIC: "radar-bulk-import",
  RADAR_BULK_IMPORT_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  buildRadarBulkImportIdempotencyKey: (payload: RadarBulkImportPayload) =>
    `${payload.jobId}:${payload.batchIndex}`,
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
}))

const { processRadarBulkImportMessage } = await import("./route")

const processClaimedBatch = mock(async () => new Output(true, [], [], { ok: true }))

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "radar-bulk-import",
  region: "gru1",
}

describe("processRadarBulkImportMessage", () => {
  beforeEach(() => {
    processClaimedBatch.mockReset()
    processClaimedBatch.mockResolvedValue(new Output(true, [], [], { ok: true }))
  })

  it("chama processClaimedBatch com deliveryCount", async () => {
    const message = { jobId: "job-1", batchIndex: 0 }
    await processRadarBulkImportMessage(message, metadata, { processClaimedBatch })
    expect(processClaimedBatch).toHaveBeenCalledWith(message, { deliveryCount: 1 })
  })

  it("payload inválido: ack sem processar", async () => {
    await processRadarBulkImportMessage(
      { jobId: "", batchIndex: 0 },
      metadata,
      { processClaimedBatch }
    )
    expect(processClaimedBatch).not.toHaveBeenCalled()
  })

  it("!isValid: lança para retry", async () => {
    processClaimedBatch.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processRadarBulkImportMessage({ jobId: "job-1", batchIndex: 0 }, metadata, {
        processClaimedBatch,
      })
    ).rejects.toThrow("falhou")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    processClaimedBatch.mockResolvedValue(new Output(false, [], ["falhou"], null))
    await expect(
      processRadarBulkImportMessage(
        { jobId: "job-1", batchIndex: 0 },
        { ...metadata, deliveryCount: 20 },
        { processClaimedBatch },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "radar-bulk-import",
        idempotencyKey: "job-1:0",
        deliveryCount: 20,
      }),
    )
  })
})
