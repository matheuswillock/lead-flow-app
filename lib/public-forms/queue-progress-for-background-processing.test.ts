import { describe, it, expect, mock, beforeEach } from "bun:test"
import { DEFAULT_PUBLISH_RETRY_ATTEMPTS } from "@/lib/queues/publish-with-retry"
import type { PublicFormProgressQueuePayload } from "@/lib/queues/public-form-progress-events"

const publishPublicFormProgressEventMock = mock(async () => ({ messageId: "mid-test" }))
const upsertFromProcessingFailureMock = mock(async () => {})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {},
}))

mock.module("@/lib/queues/public-form-progress-events", () => ({
  publishPublicFormProgressEvent: publishPublicFormProgressEventMock,
  PUBLIC_FORM_PROGRESS_EVENTS_TOPIC: "public-form-progress-events",
}))

mock.module(
  "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository",
  () => ({
    queueProcessingFailureRepository: {
      upsertFromProcessingFailure: upsertFromProcessingFailureMock,
    },
  }),
)

const { queueProgressForBackgroundProcessing } = await import(
  "./queue-progress-for-background-processing"
)

const PAYLOAD: PublicFormProgressQueuePayload = {
  publicId: "11111111-1111-4111-8111-111111111111",
  visitorSessionId: "session_abcdefghij",
  answers: [{ questionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", value: "Ana" }],
  origin: {},
  idempotencyKey: "progress:session_abcdefghij:pub:q:hash",
}

describe("queueProgressForBackgroundProcessing", () => {
  beforeEach(() => {
    publishPublicFormProgressEventMock.mockReset()
    publishPublicFormProgressEventMock.mockResolvedValue({ messageId: "mid-test" })
    upsertFromProcessingFailureMock.mockReset()
  })

  it("publish com sucesso: não grava no outbox", async () => {
    await queueProgressForBackgroundProcessing(PAYLOAD, {
      publish: publishPublicFormProgressEventMock,
      persistOutbox: upsertFromProcessingFailureMock,
    })

    expect(publishPublicFormProgressEventMock).toHaveBeenCalledWith(PAYLOAD, {
      idempotencyKey: PAYLOAD.idempotencyKey,
    })
    expect(upsertFromProcessingFailureMock).not.toHaveBeenCalled()
  })

  it("publish falha 3x → grava no outbox QueueProcessingFailure", async () => {
    publishPublicFormProgressEventMock.mockRejectedValue(new Error("queue down"))

    await queueProgressForBackgroundProcessing(PAYLOAD, {
      publish: publishPublicFormProgressEventMock,
      persistOutbox: upsertFromProcessingFailureMock,
    })

    expect(publishPublicFormProgressEventMock).toHaveBeenCalledTimes(DEFAULT_PUBLISH_RETRY_ATTEMPTS)
    expect(upsertFromProcessingFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-progress-events",
        idempotencyKey: PAYLOAD.idempotencyKey,
        lastError: "queue down",
      }),
    )
  })

  it("publish falha 3x e outbox também falha: não lança", async () => {
    publishPublicFormProgressEventMock.mockRejectedValue(new Error("queue down"))
    upsertFromProcessingFailureMock.mockRejectedValueOnce(new Error("db down"))

    await expect(
      queueProgressForBackgroundProcessing(PAYLOAD, {
        publish: publishPublicFormProgressEventMock,
        persistOutbox: upsertFromProcessingFailureMock,
      }),
    ).resolves.toBeUndefined()
  })
})
