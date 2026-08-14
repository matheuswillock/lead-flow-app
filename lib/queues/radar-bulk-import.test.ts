import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishRadarBulkImportBatch,
  buildRadarBulkImportIdempotencyKey,
  RADAR_BULK_IMPORT_TOPIC,
  RADAR_BULK_IMPORT_RETENTION_SECONDS,
} = await import("./radar-bulk-import")

describe("publishRadarBulkImportBatch", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia jobId:batchIndex como idempotencyKey", async () => {
    const payload = { jobId: "job-1", batchIndex: 2 }
    const result = await publishRadarBulkImportBatch(payload)
    expect(result.messageId).toBe("mid-1")
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(RADAR_BULK_IMPORT_TOPIC)
    expect(call[2]).toEqual({
      idempotencyKey: "job-1:2",
      retentionSeconds: RADAR_BULK_IMPORT_RETENTION_SECONDS,
    })
  })
})

describe("buildRadarBulkImportIdempotencyKey", () => {
  it("usa jobId:batchIndex", () => {
    expect(buildRadarBulkImportIdempotencyKey({ jobId: "j", batchIndex: 0 })).toBe("j:0")
  })
})
