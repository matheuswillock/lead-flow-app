import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { PublicFormProgressQueuePayload } from "@/lib/queues/public-form-progress-events"

const execute = mock(async () => new Output(true, [], [], { submissionId: "sub-1" }))

mock.module("@/app/api/useCases/publicForms/PublicFormProgressUseCase", () => ({
  PublicFormProgressUseCase: class PublicFormProgressUseCase {},
  publicFormProgressUseCase: { execute },
}))

mock.module("@/lib/queues/public-form-progress-events", () => ({
  handlePublicFormProgressEventsCallback: (
    handler: (
      message: PublicFormProgressQueuePayload,
      metadata: QueueMessageMetadata,
    ) => Promise<void>,
  ) => handler,
  publishPublicFormProgressEvent: mock(async () => ({ messageId: "mid-test" })),
  PUBLIC_FORM_PROGRESS_EVENTS_TOPIC: "public-form-progress-events",
  PUBLIC_FORM_PROGRESS_EVENTS_RETENTION_SECONDS: 60 * 60 * 24 * 7,
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

const { processPublicFormProgressEventMessage } = await import("./route")

const baseMessage = (): PublicFormProgressQueuePayload => ({
  publicId: "11111111-1111-4111-8111-111111111111",
  schemaVersion: 1,
  eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  occurredAt: "2026-08-21T00:00:00.000Z",
  trigger: "blur",
  visitorSessionId: "session_abcdefghij",
  answers: [{ questionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", value: "Ana" }],
  origin: {},
  idempotencyKey: "progress:session_abcdefghij:pub:q:hash",
})

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "public-form-progress-events",
  region: "gru1",
}

describe("processPublicFormProgressEventMessage", () => {
  beforeEach(() => {
    execute.mockReset()
    execute.mockResolvedValue(new Output(true, [], [], { submissionId: "sub-1" }))
  })

  it("chama execute com publicId e o payload de progresso", async () => {
    const message = baseMessage()
    await processPublicFormProgressEventMessage(message, metadata, { execute })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(message.publicId, {
      visitorSessionId: message.visitorSessionId,
      answers: message.answers,
      origin: message.origin,
      lastQuestionId: undefined,
      schemaVersion: message.schemaVersion,
      eventId: message.eventId,
      occurredAt: message.occurredAt,
      trigger: message.trigger,
    })
  })

  it("payload sem publicId: ack sem chamar execute", async () => {
    await processPublicFormProgressEventMessage(
      { ...baseMessage(), publicId: "" },
      metadata,
      { execute },
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("T-Q3.2 — payload inválido gera linha invalid_payload no outbox e acka", async () => {
    const ackDeadLetter = mock(async () => true)

    await expect(
      processPublicFormProgressEventMessage(
        { ...baseMessage(), publicId: "" },
        metadata,
        { execute },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()

    expect(execute).not.toHaveBeenCalled()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-progress-events",
        idempotencyKey: "progress:session_abcdefghij:pub:q:hash",
        maxDeliveryCount: 1,
        lastError: "invalid_payload: campos obrigatórios ausentes: publicId",
      }),
    )
  })

  it("form unavailable: ack sem throw", async () => {
    execute.mockResolvedValueOnce(new Output(false, [], ["Formulário indisponível"], null))
    await expect(
      processPublicFormProgressEventMessage(baseMessage(), metadata, { execute }),
    ).resolves.toBeUndefined()
  })

  it("erro transitório: propaga throw para retry do handleCallback", async () => {
    execute.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processPublicFormProgressEventMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 2 },
        { execute },
      ),
    ).rejects.toThrow("P2024")
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    execute.mockRejectedValueOnce(new Error("P2002"))
    await expect(
      processPublicFormProgressEventMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 20 },
        { execute },
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-progress-events",
        idempotencyKey: "progress:session_abcdefghij:pub:q:hash",
        deliveryCount: 20,
      }),
    )
  })
})
