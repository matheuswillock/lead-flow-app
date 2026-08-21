import { describe, it, expect, mock, beforeEach } from "bun:test"
import { DEFAULT_PUBLISH_RETRY_ATTEMPTS } from "@/lib/queues/publish-with-retry"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"

const publishPublicFormSubmissionEventMock = mock(async () => ({ messageId: "mid-test" }))
const upsertFromProcessingFailureMock = mock(async () => {})
const markAcceptedMock = mock(async () => {})
const markDeferredMock = mock(async () => {})
const dependencies = { markAccepted: markAcceptedMock, markDeferred: markDeferredMock }

mock.module("@/lib/queues/public-form-submission-events", () => ({
  publishPublicFormSubmissionEvent: publishPublicFormSubmissionEventMock,
  PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC: "public-form-submission-events",
  PUBLIC_FORM_SUBMISSION_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
  handlePublicFormSubmissionEventsCallback: (handler: unknown) => handler,
}))

mock.module(
  "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository",
  () => ({
    formatProcessingError: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
    publicFormQueueEventFailureRepository: {
      upsertFromProcessingFailure: upsertFromProcessingFailureMock,
    },
  }),
)

const { queueSubmissionForBackgroundProcessing } = await import(
  "./queue-submission-for-background-processing"
)

const JOB = {
  submissionId: "sub-1",
  publicationId: "pub-1",
  snapshot: { formId: "form-1", questions: [] },
  visibleAnswers: [],
  visibleIds: [],
  score: 90,
  scoreBandLabel: "Quente",
  origin: {},
  requestKey: "req-abc",
  visitorSessionId: "session-1",
  thankYouPageId: null,
} as unknown as PublicFormSubmissionBackgroundJob

describe("queueSubmissionForBackgroundProcessing (PR2.3)", () => {
  beforeEach(() => {
    publishPublicFormSubmissionEventMock.mockReset()
    publishPublicFormSubmissionEventMock.mockResolvedValue({ messageId: "mid-test" })
    upsertFromProcessingFailureMock.mockReset()
    markAcceptedMock.mockReset()
    markDeferredMock.mockReset()
  })

  it("publish com sucesso: não grava no outbox", async () => {
    await queueSubmissionForBackgroundProcessing(JOB, dependencies)

    expect(publishPublicFormSubmissionEventMock).toHaveBeenCalledWith(JOB)
    expect(upsertFromProcessingFailureMock).not.toHaveBeenCalled()
  })

  it("publish falha 3x → grava no outbox com kind=submission e queue_publish_failed", async () => {
    publishPublicFormSubmissionEventMock.mockRejectedValue(new Error("queue down"))

    await queueSubmissionForBackgroundProcessing(JOB, dependencies)

    expect(publishPublicFormSubmissionEventMock).toHaveBeenCalledTimes(
      DEFAULT_PUBLISH_RETRY_ATTEMPTS,
    )
    expect(upsertFromProcessingFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "submission",
        idempotencyKey: "req-abc",
        failureReason: "queue_publish_failed",
      }),
    )
  })

  it("publish falha 3x e outbox também falha: não lança (after() não deve rejeitar)", async () => {
    publishPublicFormSubmissionEventMock.mockRejectedValue(new Error("queue down"))
    upsertFromProcessingFailureMock.mockRejectedValueOnce(new Error("db down"))

    await expect(queueSubmissionForBackgroundProcessing(JOB, dependencies)).resolves.toEqual({
      accepted: false,
    })
  })
})
