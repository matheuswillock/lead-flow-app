import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextResponse } from "next/server"

mock.module("next/server", () => ({
  NextResponse,
}))

mock.module("@vercel/queue", () => ({
  QueueClient: class {
    send = mock(async () => ({ messageId: "mid" }))
    handleCallback = (handler: unknown) => handler
  },
}))

mock.module("@/lib/public-forms/rate-limit", () => ({
  consumePublicFormRateLimit: mock(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  publicFormRequestFingerprint: mock(() => "fp-test"),
}))

const queueProgressForBackgroundProcessing = mock(async () => {})
mock.module("@/lib/public-forms/queue-progress-for-background-processing", () => ({
  queueProgressForBackgroundProcessing,
}))

mock.module("@/lib/e2e/is-e2e-test-mode", () => ({
  isE2eTestMode: () => false,
}))

const { POST } = await import("./route")

const VALID_PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const VALID_SESSION = "session_abcdefghij"
const QUESTION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

function makeRequest(body: unknown): Request {
  return new Request(`http://localhost/api/v1/public-forms/${VALID_PUBLIC_ID}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/v1/public-forms/[publicId]/progress", () => {
  beforeEach(() => {
    queueProgressForBackgroundProcessing.mockReset()
    queueProgressForBackgroundProcessing.mockResolvedValue(undefined)
  })

  it("queue-first: loga blur, publica e retorna 202 sem chamar execute", async () => {
    const info = mock(() => {})
    const originalInfo = console.info
    console.info = info as typeof console.info

    const res = await POST(
      makeRequest({
        visitorSessionId: VALID_SESSION,
        answers: [{ questionId: QUESTION_ID, value: "Ana" }],
        origin: {},
      }),
      { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) },
    )
    console.info = originalInfo

    expect(res.status).toBe(202)
    const body = (await res.json()) as { result: { queued?: boolean } }
    expect(body.result.queued).toBe(true)
    expect(queueProgressForBackgroundProcessing).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      "[PublicFormProgress][blur]",
      expect.objectContaining({
        publicId: VALID_PUBLIC_ID,
        visitorSessionId: VALID_SESSION,
        questionId: QUESTION_ID,
        value: "Ana",
      }),
    )
  })

  it("progresso inválido: 400 sem publicar", async () => {
    const res = await POST(makeRequest({ visitorSessionId: "curto", answers: [] }), {
      params: Promise.resolve({ publicId: VALID_PUBLIC_ID }),
    })
    expect(res.status).toBe(400)
    expect(queueProgressForBackgroundProcessing).not.toHaveBeenCalled()
  })
})
