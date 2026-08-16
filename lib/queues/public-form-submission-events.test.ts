import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishPublicFormSubmissionEvent,
  PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC,
  PUBLIC_FORM_SUBMISSION_EVENTS_RETENTION_SECONDS,
} = await import("./public-form-submission-events")

const basePayload = {
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
} as unknown as PublicFormSubmissionBackgroundJob

describe("publishPublicFormSubmissionEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com payload completo, idempotencyKey = requestKey e retenção de 7 dias", async () => {
    const result = await publishPublicFormSubmissionEvent(basePayload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof basePayload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC)
    expect(call[1]).toEqual(basePayload)
    expect(call[2]).toEqual({
      idempotencyKey: "req-abc",
      retentionSeconds: PUBLIC_FORM_SUBMISSION_EVENTS_RETENTION_SECONDS,
    })
  })

  it("retorna { messageId } do resultado do send", async () => {
    send.mockResolvedValue({ messageId: "mid-queued" })
    const result = await publishPublicFormSubmissionEvent(basePayload)
    expect(result).toEqual({ messageId: "mid-queued" })
  })

  it("aceita idempotencyKey explícita (usada pelo republish do outbox) sobrepondo a requestKey", async () => {
    await publishPublicFormSubmissionEvent(basePayload, {
      idempotencyKey: "req-abc:outbox-retry:row-1:2",
    })
    const call = send.mock.calls[0] as unknown as [
      string,
      typeof basePayload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[2].idempotencyKey).toBe("req-abc:outbox-retry:row-1:2")
  })
})
