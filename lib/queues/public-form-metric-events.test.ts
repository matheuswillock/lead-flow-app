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
})

describe("public-form-metric-events helpers", () => {
  it("classifica apenas form_viewed, question_answered e form_completed como críticos", () => {
    expect(isCriticalPublicFormMetricEvent("form_viewed")).toBe(true)
    expect(isCriticalPublicFormMetricEvent("question_answered")).toBe(true)
    expect(isCriticalPublicFormMetricEvent("form_completed")).toBe(true)
    expect(isCriticalPublicFormMetricEvent("form_started")).toBe(false)
    expect(isCriticalPublicFormMetricEvent("question_viewed")).toBe(false)
    expect(isCriticalPublicFormMetricEvent("question_skipped")).toBe(false)
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
