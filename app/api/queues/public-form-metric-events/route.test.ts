import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PublicFormMetricQueuePayload } from "@/lib/queues/public-form-metric-events"

const persistQueuedMetric = mock(async (_publicId: string, _input: unknown) => true)

mock.module("@/app/api/useCases/publicForms/PublicFormsUseCase", () => ({
  PublicFormsUseCase: class PublicFormsUseCase {},
  publicFormsUseCase: { persistQueuedMetric },
}))

mock.module("@/lib/queues/public-form-metric-events", () => ({
  handlePublicFormMetricEventsCallback: (handler: unknown) => handler,
  PUBLIC_FORM_METRIC_EVENTS_TOPIC: "public-form-metric-events",
}))

mock.module("@/lib/queues/queue-processing-failure", () => ({
  ackAfterMaxDeliveries: mock(async () => false),
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
  createCrmLead: false,
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

  it("deliveryCount abaixo do limite: helper retorna false e o erro propaga", async () => {
    const ackDeadLetter = mock(async () => false)
    persistQueuedMetric.mockRejectedValueOnce(new Error("P2003"))

    await expect(
      processPublicFormMetricQueueMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 2 },
        undefined,
        ackDeadLetter,
      ),
    ).rejects.toThrow("P2003")

    expect(ackDeadLetter).toHaveBeenCalledTimes(1)
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-metric-events",
        idempotencyKey: "session_abcdefghij:form_viewed:form",
        deliveryCount: 2,
      }),
    )
  })

  it("deliveryCount excedeu o limite: helper acka sem throw", async () => {
    const ackDeadLetter = mock(async () => true)
    persistQueuedMetric.mockRejectedValueOnce(new Error("Foreign key constraint violated"))

    await expect(
      processPublicFormMetricQueueMessage(
        baseMessage(),
        { ...metadata, deliveryCount: 25 },
        undefined,
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()

    expect(ackDeadLetter).toHaveBeenCalledTimes(1)
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-metric-events",
        idempotencyKey: "session_abcdefghij:form_viewed:form",
        deliveryCount: 25,
      }),
    )
  })

  it("payload inválido: ack sem chamar persistQueuedMetric", async () => {
    await processPublicFormMetricQueueMessage(
      { ...baseMessage(), eventKey: "" },
      metadata,
    )
    expect(persistQueuedMetric).not.toHaveBeenCalled()
  })

  it("T-Q3.2 — payload inválido gera linha invalid_payload no outbox e acka", async () => {
    const ackDeadLetter = mock(async () => true)

    await expect(
      processPublicFormMetricQueueMessage(
        { ...baseMessage(), publicId: "" },
        metadata,
        undefined,
        ackDeadLetter,
      ),
    ).resolves.toBeUndefined()

    expect(persistQueuedMetric).not.toHaveBeenCalled()
    expect(ackDeadLetter).toHaveBeenCalledTimes(1)
    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "public-form-metric-events",
        idempotencyKey: "session_abcdefghij:form_viewed:form",
        maxDeliveryCount: 1,
        lastError: "invalid_payload: campos obrigatórios ausentes: publicId",
      }),
    )
  })

  it("T-Q3.2 — sem chave no payload, a linha usa o messageId como idempotencyKey", async () => {
    const ackDeadLetter = mock(async () => true)

    await processPublicFormMetricQueueMessage(
      { ...baseMessage(), publicId: "", eventKey: "" },
      metadata,
      undefined,
      ackDeadLetter,
    )

    expect(ackDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "invalid_payload:msg-1" }),
    )
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
