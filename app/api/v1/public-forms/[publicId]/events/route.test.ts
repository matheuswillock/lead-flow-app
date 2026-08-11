import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG } from "@/lib/queues/public-form-metric-events"

mock.module("next/server", () => ({
  NextResponse,
}))

mock.module("@/lib/public-forms/rate-limit", () => ({
  consumePublicFormRateLimit: mock(async () => ({ allowed: true, retryAfterSeconds: 0 })),
  publicFormRequestFingerprint: mock(() => "fp-test"),
}))

const recordMetric = mock(async (_publicId: string, _input: unknown) => new Output(true, [], [], { accepted: true }))

mock.module("@/app/api/useCases/publicForms/PublicFormsUseCase", () => ({
  publicFormsUseCase: { recordMetric },
}))

const { POST } = await import("./route")

const VALID_PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const VALID_SESSION = "session_abcdefghij"
const VALID_EVENT_KEY = "session_abcdefghij:form_viewed:form"

function makeRequest(body: unknown): Request {
  return new Request(`http://localhost/api/v1/public-forms/${VALID_PUBLIC_ID}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/v1/public-forms/[publicId]/events", () => {
  beforeEach(() => {
    recordMetric.mockReset()
    recordMetric.mockResolvedValue(new Output(true, [], [], { accepted: true }))
  })

  it("evento crítico: chama recordMetric (queue-first no UseCase) e retorna 202 queued", async () => {
    recordMetric.mockResolvedValueOnce(new Output(true, [], [], { queued: true, messageId: "msg-1" }))

    const res = await POST(makeRequest({
      visitorSessionId: VALID_SESSION,
      eventType: "form_viewed",
      eventKey: VALID_EVENT_KEY,
      origin: {},
    }), { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) })

    expect(res.status).toBe(202)
    const body = (await res.json()) as { result: { queued?: boolean } }
    expect(body.result.queued).toBe(true)
    expect(recordMetric).toHaveBeenCalledTimes(1)
    expect(recordMetric.mock.calls[0]?.[1]).toMatchObject({ eventType: "form_viewed" })
  })

  it("evento não crítico: usa caminho direto via recordMetric e retorna 202 accepted", async () => {
    recordMetric.mockResolvedValueOnce(new Output(true, [], [], { accepted: true }))

    const res = await POST(makeRequest({
      visitorSessionId: VALID_SESSION,
      eventType: "form_started",
      eventKey: `${VALID_SESSION}:form_started:form`,
      origin: {},
    }), { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) })

    expect(res.status).toBe(202)
    const body = (await res.json()) as { result: { accepted?: boolean; queued?: boolean } }
    expect(body.result.accepted).toBe(true)
    expect(body.result.queued).toBeUndefined()
    expect(recordMetric).toHaveBeenCalledTimes(1)
    expect(recordMetric.mock.calls[0]?.[1]).toMatchObject({ eventType: "form_started" })
  })

  it("falha de publish: retorna 502 instrumentado com tag public_form_metric_queue_publish_failed", async () => {
    recordMetric.mockResolvedValueOnce(
      new Output(false, [], ["Falha ao enfileirar evento de métrica"], {
        code: PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
      }),
    )

    const res = await POST(makeRequest({
      visitorSessionId: VALID_SESSION,
      eventType: "question_answered",
      questionId: "11111111-1111-4111-8111-111111111111",
      eventKey: `${VALID_SESSION}:question_answered:q1`,
      origin: {},
    }), { params: Promise.resolve({ publicId: VALID_PUBLIC_ID }) })

    expect(res.status).toBe(502)
    const body = (await res.json()) as {
      isValid: boolean
      result: { code?: string }
    }
    expect(body.isValid).toBe(false)
    expect(body.result.code).toBe(PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG)
  })

  it("payload inválido: retorna 400 sem chamar recordMetric", async () => {
    const res = await POST(makeRequest({ eventType: "form_viewed" }), {
      params: Promise.resolve({ publicId: VALID_PUBLIC_ID }),
    })
    expect(res.status).toBe(400)
    expect(recordMetric).not.toHaveBeenCalled()
  })
})
