import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PublicFormProgressQueuePayload } from "./public-form-progress-events"

const send = mock(async () => ({ messageId: "mid-1" }))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = send
    handleCallback = (handler: unknown) => handler
  },
}))

const {
  publishPublicFormProgressEvent,
  buildPublicFormProgressIdempotencyKey,
  buildPublicFormProgressQueuePayload,
  hashPublicFormProgressValue,
  PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
  PUBLIC_FORM_PROGRESS_EVENTS_RETENTION_SECONDS,
} = await import("./public-form-progress-events")

const QUESTION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const SESSION = "session_abcdefghij"

const basePayload = (): PublicFormProgressQueuePayload =>
  buildPublicFormProgressQueuePayload({
    publicId: PUBLIC_ID,
    visitorSessionId: SESSION,
    answers: [{ questionId: QUESTION_ID, value: "Ana" }],
    origin: { utmSource: "test" },
  })

describe("buildPublicFormProgressIdempotencyKey (D1)", () => {
  it("blur vazio e blur preenchido não compartilham a chave", () => {
    const emptyKey = buildPublicFormProgressIdempotencyKey({
      visitorSessionId: SESSION,
      publicId: PUBLIC_ID,
      answers: [{ questionId: QUESTION_ID, value: "" }],
    })
    const filledKey = buildPublicFormProgressIdempotencyKey({
      visitorSessionId: SESSION,
      publicId: PUBLIC_ID,
      answers: [{ questionId: QUESTION_ID, value: "Ana" }],
    })
    expect(emptyKey).not.toBe(filledKey)
    expect(emptyKey).toBe(
      `progress:${SESSION}:${PUBLIC_ID}:${QUESTION_ID}:${hashPublicFormProgressValue("")}`,
    )
    expect(filledKey).toBe(
      `progress:${SESSION}:${PUBLIC_ID}:${QUESTION_ID}:${hashPublicFormProgressValue("Ana")}`,
    )
  })

  it("string só com espaços hash igual a vazio — não colide com valor preenchido", () => {
    const blankKey = buildPublicFormProgressIdempotencyKey({
      visitorSessionId: SESSION,
      publicId: PUBLIC_ID,
      answers: [{ questionId: QUESTION_ID, value: "   " }],
    })
    const emptyKey = buildPublicFormProgressIdempotencyKey({
      visitorSessionId: SESSION,
      publicId: PUBLIC_ID,
      answers: [{ questionId: QUESTION_ID, value: "" }],
    })
    expect(blankKey).toBe(emptyKey)
  })
})

describe("publishPublicFormProgressEvent", () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ messageId: "mid-1" })
  })

  it("envia para o tópico com idempotencyKey do payload e retenção de 7 dias", async () => {
    const payload = basePayload()
    const result = await publishPublicFormProgressEvent(payload)
    expect(result.messageId).toBe("mid-1")
    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0] as unknown as [
      string,
      PublicFormProgressQueuePayload,
      { idempotencyKey: string; retentionSeconds: number },
    ]
    expect(call[0]).toBe(PUBLIC_FORM_PROGRESS_EVENTS_TOPIC)
    expect(call[1]).toEqual(payload)
    expect(call[2]).toEqual({
      idempotencyKey: payload.idempotencyKey,
      retentionSeconds: PUBLIC_FORM_PROGRESS_EVENTS_RETENTION_SECONDS,
    })
  })

  it("aceita idempotencyKey explícita (republish do outbox)", async () => {
    const payload = basePayload()
    await publishPublicFormProgressEvent(payload, {
      idempotencyKey: `${payload.idempotencyKey}:outbox-retry:row-1:2`,
    })
    const call = send.mock.calls[0] as unknown as [
      string,
      PublicFormProgressQueuePayload,
      { idempotencyKey: string },
    ]
    expect(call[2].idempotencyKey).toBe(`${payload.idempotencyKey}:outbox-retry:row-1:2`)
  })
})
