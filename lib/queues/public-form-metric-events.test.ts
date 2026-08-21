import { describe, it, expect, mock, beforeEach } from "bun:test"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishPublicFormMetricEvent,
  publishServerPublicFormMetricEvent,
  isCriticalPublicFormMetricEvent,
  buildPublicFormMetricQueuePayload,
  PUBLIC_FORM_METRIC_EVENTS_TOPIC,
  PUBLIC_FORM_METRIC_EVENTS_RETENTION_SECONDS,
} = await import("./public-form-metric-events")

describe("publishPublicFormMetricEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com eventKey como idempotencyKey e retenção de 7 dias", async () => {
    const payload = {
      publicId: "11111111-1111-4111-8111-111111111111",
      eventKey: "idem-key-1234567890",
      eventType: "form_viewed" as const,
      questionId: null,
      visitorSessionId: "session_abcdefghij",
      origin: {},
      answerMappingKey: null,
      answerValue: null,
      receivedAt: "2026-08-11T12:00:00.000Z",
    }
    const result = await publishPublicFormMetricEvent(payload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(PUBLIC_FORM_METRIC_EVENTS_TOPIC)
    expect(call[1]).toEqual(payload)
    expect(call[2]).toEqual({
      idempotencyKey: "idem-key-1234567890",
      retentionSeconds: PUBLIC_FORM_METRIC_EVENTS_RETENTION_SECONDS,
    })
  })

  it("aceita idempotencyKey explícita (usada pelo republish do outbox) sobrepondo a eventKey", async () => {
    const payload = {
      publicId: "11111111-1111-4111-8111-111111111111",
      eventKey: "idem-key-1234567890",
      eventType: "form_viewed" as const,
      questionId: null,
      visitorSessionId: "session_abcdefghij",
      origin: {},
      answerMappingKey: null,
      answerValue: null,
      receivedAt: "2026-08-11T12:00:00.000Z",
    }
    await publishPublicFormMetricEvent(payload, {
      idempotencyKey: "idem-key-1234567890:outbox-retry:row-1:2",
    })
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof payload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[2].idempotencyKey).toBe("idem-key-1234567890:outbox-retry:row-1:2")
  })
})

describe("public-form-metric-events helpers", () => {
  it("classifica form_viewed, form_started, question_answered e form_completed como críticos", () => {
    expect(isCriticalPublicFormMetricEvent("form_viewed")).toBe(true)
    expect(isCriticalPublicFormMetricEvent("form_started")).toBe(true)
    expect(isCriticalPublicFormMetricEvent("question_answered")).toBe(true)
    expect(isCriticalPublicFormMetricEvent("form_completed")).toBe(true)
    expect(isCriticalPublicFormMetricEvent("question_viewed")).toBe(false)
    expect(isCriticalPublicFormMetricEvent("question_skipped")).toBe(false)
    expect(isCriticalPublicFormMetricEvent("lead_created")).toBe(false)
    expect(isCriticalPublicFormMetricEvent("lead_attached")).toBe(false)
    expect(isCriticalPublicFormMetricEvent("meeting_scheduled")).toBe(false)
  })

  it("buildPublicFormMetricQueuePayload aceita tipos server-side", () => {
    const payload = buildPublicFormMetricQueuePayload("11111111-1111-4111-8111-111111111111", {
      visitorSessionId: "session_abcdefghij",
      eventType: "lead_created",
      eventKey: "key-lead",
      origin: { source: "submission" },
    })
    expect(payload.eventType).toBe("lead_created")
    expect(payload.eventKey).toBe("key-lead")
  })

  it("buildPublicFormMetricQueuePayload usa eventKey e origin", () => {
    const payload = buildPublicFormMetricQueuePayload("11111111-1111-4111-8111-111111111111", {
      visitorSessionId: "session_abcdefghij",
      eventType: "question_answered",
      questionId: "11111111-1111-4111-8111-111111111111",
      eventKey: "key-abc",
      origin: { utmSource: "email" },
    })
    expect(payload.eventKey).toBe("key-abc")
    expect(payload.questionId).toBe("11111111-1111-4111-8111-111111111111")
    expect(payload.origin).toEqual({ utmSource: "email" })
    expect(payload.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe("publishServerPublicFormMetricEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("publica com idempotencyKey = eventKey", async () => {
    await publishServerPublicFormMetricEvent(
      {
        publicId: "11111111-1111-4111-8111-111111111111",
        eventKey: "session:lead_created:form",
        eventType: "lead_created",
        questionId: null,
        visitorSessionId: "session_abcdefghij",
        origin: {},
        answerMappingKey: null,
        answerValue: null,
        receivedAt: "2026-08-14T12:00:00.000Z",
      },
      "PublicFormSubmissionUseCase",
    )
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      { eventType: string },
      { idempotencyKey: string },
    ]
    expect(call[1].eventType).toBe("lead_created")
    expect(call[2].idempotencyKey).toBe("session:lead_created:form")
  })

  it("falha de publish retorna false sem propagar (log + ack local)", async () => {
    send.mockRejectedValueOnce(new Error("queue down"))
    await expect(
      publishServerPublicFormMetricEvent(
        {
          publicId: "11111111-1111-4111-8111-111111111111",
          eventKey: "session:form_completed:form",
          eventType: "form_completed",
          questionId: null,
          visitorSessionId: "session_abcdefghij",
          origin: {},
          answerMappingKey: null,
          answerValue: null,
          receivedAt: "2026-08-14T12:00:00.000Z",
        },
        "PublicFormSubmissionUseCase",
      ),
    ).resolves.toBe(false)
  })
})
