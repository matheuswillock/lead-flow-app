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

/**
 * Só o repositório é stubado — `queue-processing-failure` roda de verdade. É o
 * que faz a chave e o `reason` assertados aqui serem os mesmos que produção
 * grava; reimplementar os helpers dentro do mock passaria sempre.
 */
const recordTerminalFailure = mock(async (_input: unknown) => {})
const upsertFromProcessingFailure = mock(async (_input: unknown) => {})

mock.module(
  "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository",
  () => ({
    queueProcessingFailureRepository: { recordTerminalFailure, upsertFromProcessingFailure },
  }),
)

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

  /**
   * T-Q3.2 + review #1042. Payload malformado é falha **terminal**: se entrasse
   * como `pending`, o cron de retry republicaria o mesmo payload e o ciclo
   * fila↔outbox não fecharia nunca. O `reason` nomeia o campo que faltou.
   */
  it("T-Q3.2 — payload inválido grava dead-letter TERMINAL nomeando o campo, e acka", async () => {
    recordTerminalFailure.mockClear()
    upsertFromProcessingFailure.mockClear()

    await expect(
      processPublicFormSubmissionEventMessage(
        { ...baseMessage(), snapshot: undefined } as unknown as PublicFormSubmissionBackgroundJob,
        metadata,
        { processInBackground },
      ),
    ).resolves.toBeUndefined()

    expect(processInBackground).not.toHaveBeenCalled()
    expect(upsertFromProcessingFailure).not.toHaveBeenCalled()
    expect(recordTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-submission-events",
        idempotencyKey: "req-abc",
        lastError: "campos obrigatórios ausentes: snapshot",
      }),
    )
  })

  it("T-Q3.2 — sem chave no payload, a linha usa o messageId como idempotencyKey", async () => {
    recordTerminalFailure.mockClear()

    await processPublicFormSubmissionEventMessage(
      {} as unknown as PublicFormSubmissionBackgroundJob,
      metadata,
      { processInBackground },
    )

    expect(recordTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "invalid-payload:msg-1" }),
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
