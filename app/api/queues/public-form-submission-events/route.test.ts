import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"

const processInBackground = mock(async () => {})

// PublicFormSubmissionUseCase.ts carrega uma cadeia pesada de serviços
// (lead/agenda/Google) que não pode ser importada em teste sem mock.
mock.module("@/app/api/useCases/publicForms/PublicFormSubmissionUseCase", () => ({
  publicFormSubmissionUseCase: { processInBackground },
}))

mock.module("@/lib/queues/public-form-submission-events", () => ({
  handlePublicFormSubmissionEventsCallback: (
    handler: (
      message: PublicFormSubmissionBackgroundJob,
      metadata: QueueMessageMetadata,
    ) => Promise<void>,
  ) => handler,
  publishPublicFormSubmissionEvent: mock(async () => ({ messageId: "mid-test" })),
  PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC: "public-form-submission-events",
  PUBLIC_FORM_SUBMISSION_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
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

const { processPublicFormSubmissionEventMessage } = await import("./route")

const baseMessage = (): PublicFormSubmissionBackgroundJob =>
  ({
    submissionId: "sub-1",
    publicationId: "pub-1",
    snapshot: { formId: "form-1", questions: [] },
    visibleAnswers: [],
    visibleIds: [],
    score: 80,
    scoreBandLabel: "Quente",
    origin: {},
    requestKey: "req-abc",
    visitorSessionId: "session-1",
    thankYouPageId: null,
  }) as unknown as PublicFormSubmissionBackgroundJob

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "public-form-submission-events",
  region: "gru1",
}

describe("processPublicFormSubmissionEventMessage", () => {
  beforeEach(() => {
    processInBackground.mockReset()
    processInBackground.mockResolvedValue(undefined)
  })

  it("chama processInBackground com o job completo", async () => {
    const message = baseMessage()
    await processPublicFormSubmissionEventMessage(message, metadata, { processInBackground })
    expect(processInBackground).toHaveBeenCalledTimes(1)
    expect(processInBackground).toHaveBeenCalledWith(message)
  })

  it("payload sem submissionId: ack sem chamar processInBackground", async () => {
    await processPublicFormSubmissionEventMessage(
      { ...baseMessage(), submissionId: "" },
      metadata,
      { processInBackground },
    )
    expect(processInBackground).not.toHaveBeenCalled()
  })

  it("payload sem requestKey: ack sem chamar processInBackground", async () => {
    await processPublicFormSubmissionEventMessage(
      { ...baseMessage(), requestKey: "" },
      metadata,
      { processInBackground },
    )
    expect(processInBackground).not.toHaveBeenCalled()
  })

  it("payload sem snapshot: ack sem chamar processInBackground", async () => {
    await processPublicFormSubmissionEventMessage(
      { ...baseMessage(), snapshot: undefined } as unknown as PublicFormSubmissionBackgroundJob,
      metadata,
      { processInBackground },
    )
    expect(processInBackground).not.toHaveBeenCalled()
  })

  it("T-Q3.2 — payload inválido gera linha invalid_payload no outbox e acka", async () => {
    const ackDeadLetter = mock(async () => true)

    await expect(
      processPublicFormSubmissionEventMessage(
        { ...baseMessage(), snapshot: undefined } as unknown as PublicFormSubmissionBackgroundJob,
        metadata,
        { processInBackground },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()

    expect(processInBackground).not.toHaveBeenCalled()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-submission-events",
        idempotencyKey: "req-abc",
        maxDeliveryCount: 1,
        lastError: "invalid_payload: campos obrigatórios ausentes: snapshot",
      }),
    )
  })

  it("erro transitório: propaga throw para retry do handleCallback", async () => {
    processInBackground.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processPublicFormSubmissionEventMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 2 },
        { processInBackground },
      ),
    ).rejects.toThrow("P2024")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    processInBackground.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processPublicFormSubmissionEventMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20 },
        { processInBackground },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-submission-events",
        idempotencyKey: "req-abc",
        deliveryCount: 20,
      }),
    )
  })
})
