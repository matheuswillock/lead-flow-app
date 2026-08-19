import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PublicFormMetricQueuePayload } from "@/lib/queues/public-form-metric-events"

const persistQueuedMetric = mock(async (_publicId: string, _input: unknown) => true)

mock.module("@/app/api/useCases/publicForms/PublicFormsUseCase", () => ({
  PublicFormsUseCase: class PublicFormsUseCase {},
  publicFormsUseCase: { persistQueuedMetric },
}))

mock.module("@/lib/queues/public-form-metric-events", () => ({
  handlePublicFormMetricEventsCallback: (handler: unknown) => handler,
}))

const { processPublicFormMetricQueueMessage } = await import("./route")

const baseMessage = (): PublicFormMetricQueuePayload => ({
  publicId: "11111111-1111-4111-8111-111111111111",
  eventKey: "session_abcdefghij:form_viewed:form",
  eventType: "form_viewed",
  questionId: null,
  visitorSessionId: "session_abcdefghij",
  origin: { source: "queue-test" },
  answerMappingKey: null,
  answerValue: null,
  receivedAt: new Date().toISOString(),
})

const metadata = {
  messageId: "msg-1",
  deliveryCount: 1,
  topicName: "public-form-metric-events",
  region: "gru1",
}

describe("processPublicFormMetricQueueMessage", () => {
  beforeEach(() => {
    persistQueuedMetric.mockReset()
    persistQueuedMetric.mockResolvedValue(true)
  })

  it("persiste métrica via publicFormsUseCase.persistQueuedMetric", async () => {
    await processPublicFormMetricQueueMessage(baseMessage(), metadata)
    expect(persistQueuedMetric).toHaveBeenCalledTimes(1)
    expect(persistQueuedMetric.mock.calls[0]?.[0]).toBe("11111111-1111-4111-8111-111111111111")
    expect(persistQueuedMetric.mock.calls[0]?.[1]).toMatchObject({
      eventType: "form_viewed",
      eventKey: "session_abcdefghij:form_viewed:form",
      visitorSessionId: "session_abcdefghij",
    })
  })

  it("idempotência: segunda entrega com mesmo eventKey chama persist de novo (upsert no repo)", async () => {
    await processPublicFormMetricQueueMessage(baseMessage(), metadata)
    await processPublicFormMetricQueueMessage(baseMessage(), {
      ...metadata,
      messageId: "msg-2",
      deliveryCount: 2,
    })
    expect(persistQueuedMetric).toHaveBeenCalledTimes(2)
    expect(persistQueuedMetric.mock.calls[0]?.[1]).toMatchObject({
      eventKey: "session_abcdefghij:form_viewed:form",
    })
    expect(persistQueuedMetric.mock.calls[1]?.[1]).toMatchObject({
      eventKey: "session_abcdefghij:form_viewed:form",
    })
  })

  it("form unavailable: ack sem throw (sem retry)", async () => {
    persistQueuedMetric.mockResolvedValueOnce(false)
    await expect(
      processPublicFormMetricQueueMessage(baseMessage(), metadata),
    ).resolves.toBeUndefined()
  })

  it("erro transitório: propaga throw para retry do handleCallback", async () => {
    persistQueuedMetric.mockRejectedValueOnce(new Error("P2024"))
    await expect(
      processPublicFormMetricQueueMessage(baseMessage(), { ...metadata, deliveryCount: 2 }),
    ).rejects.toThrow("P2024")
  })

  it("deliveryCount abaixo do limite: não grava no outbox, só propaga o erro", async () => {
    const upsertFromProcessingFailure = mock(async () => {})
    persistQueuedMetric.mockRejectedValueOnce(new Error("P2003"))

    await expect(
      processPublicFormMetricQueueMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 2 },
        undefined,
        { upsertFromProcessingFailure },
      ),
    ).rejects.toThrow("P2003")

    expect(upsertFromProcessingFailure).not.toHaveBeenCalled()
  })

  it("deliveryCount excedeu o limite: grava no outbox (kind=metric) e acka sem throw", async () => {
    const upsertFromProcessingFailure = mock(async (_input: unknown) => {})
    persistQueuedMetric.mockRejectedValueOnce(new Error("Foreign key constraint violated"))

    await expect(
      processPublicFormMetricQueueMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 25 },
        undefined,
        { upsertFromProcessingFailure },
      ),
    ).resolves.toBeUndefined()

    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(1)
    expect(upsertFromProcessingFailure.mock.calls[0]?.[0]).toMatchObject({
      kind: "metric",
      idempotencyKey: "session_abcdefghij:form_viewed:form",
      failureReason: "delivery_count_exceeded",
    })
  })

  it("deliveryCount excedeu o limite mas outbox falha: ainda propaga throw para retry", async () => {
    const upsertFromProcessingFailure = mock(async () => {
      throw new Error("outbox indisponível")
    })
    persistQueuedMetric.mockRejectedValueOnce(new Error("Foreign key constraint violated"))

    await expect(
      processPublicFormMetricQueueMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 25 },
        undefined,
        { upsertFromProcessingFailure },
      ),
    ).rejects.toThrow("Foreign key constraint violated")

    expect(upsertFromProcessingFailure).toHaveBeenCalledTimes(1)
  })

  it("payload inválido: ack sem chamar persistQueuedMetric", async () => {
    await processPublicFormMetricQueueMessage(
      { ...baseMessage(), eventKey: "" },
      metadata,
    )
    expect(persistQueuedMetric).not.toHaveBeenCalled()
  })

  it("payload server-side lead_created persiste via UseCase", async () => {
    await processPublicFormMetricQueueMessage(
      { ...baseMessage(), eventType: "lead_created", eventKey: "session_abcdefghij:lead_created:form" },
      metadata,
    )
    expect(persistQueuedMetric).toHaveBeenCalledTimes(1)
    expect(persistQueuedMetric.mock.calls[0]?.[1]).toMatchObject({
      eventType: "lead_created",
      eventKey: "session_abcdefghij:lead_created:form",
    })
  })
})
