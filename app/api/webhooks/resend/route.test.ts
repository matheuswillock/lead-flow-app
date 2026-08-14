import { describe, expect, it, mock } from "bun:test"
import { DEFAULT_PUBLISH_RETRY_ATTEMPTS } from "@/lib/queues/publish-with-retry"

const verifyMock = mock((_body: string, _headers: Record<string, string>) => ({
  type: "email.opened",
  data: { email_id: "email-1" },
}))
const publishResendWebhookEmailLogEventMock = mock(async () => ({ messageId: "mid-test" }))
const upsertFromProcessingFailureMock = mock(async () => {})

let lastAfterPromise: Promise<unknown> = Promise.resolve()

mock.module("next/server", () => {
  class NextResponse {
    status: number
    body: unknown
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body
      this.status = init?.status ?? 200
    }
    static json(body: unknown, init?: { status?: number }) {
      return new NextResponse(body, init)
    }
  }
  return {
    NextResponse,
    after: (fn: () => unknown) => {
      lastAfterPromise = Promise.resolve().then(fn)
    },
  }
})

mock.module("svix", () => ({
  Webhook: class {
    verify(...args: [string, Record<string, string>]) {
      return verifyMock(...args)
    }
  },
}))

mock.module("@/lib/queues/resend-webhook-emaillog-events", () => ({
  publishResendWebhookEmailLogEvent: publishResendWebhookEmailLogEventMock,
}))

mock.module("@/app/api/infra/data/repositories/resendWebhookProcessingFailure/ResendWebhookProcessingFailureRepository", () => ({
  resendWebhookProcessingFailureRepository: {
    upsertFromProcessingFailure: upsertFromProcessingFailureMock,
  },
  formatProcessingError: (error: unknown) => String(error),
}))

mock.module("@/lib/http/rethrow-if-prerender-interrupted", () => ({
  rethrowIfPrerenderInterrupted: mock(() => {}),
}))

// `MAX_CONCURRENT` é lido uma única vez no module scope do route.ts, então
// precisa estar setado antes do import para o teste de saturação funcionar.
process.env.RESEND_WEBHOOK_SECRET = "whsec_test"
process.env.RESEND_WEBHOOK_MAX_CONCURRENT = "1"

const { POST } = await import("./route")

const SVIX_HEADERS = {
  "svix-id": "svix-1",
  "svix-timestamp": "1234567890",
  "svix-signature": "v1,fake",
}

const verifiedEvent = {
  type: "email.opened",
  data: { email_id: "email-1" },
}

function makeRequest(body: string, headers: Record<string, string> = SVIX_HEADERS) {
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  }) as unknown as import("next/server").NextRequest
}

describe("Resend webhook route", () => {
  it("processa normalmente e responde 200 quando há vaga no semáforo", async () => {
    publishResendWebhookEmailLogEventMock.mockClear()
    upsertFromProcessingFailureMock.mockClear()

    const response = await POST(makeRequest("{}"))
    expect(response.status).toBe(200)
    await lastAfterPromise
    expect(publishResendWebhookEmailLogEventMock).toHaveBeenCalledWith({
      event: verifiedEvent,
      svixId: "svix-1",
    })
  })

  it("responde 200 e persiste no outbox quando o semáforo está saturado, em vez de 503", async () => {
    publishResendWebhookEmailLogEventMock.mockClear()
    upsertFromProcessingFailureMock.mockClear()

    // MAX_CONCURRENT=1 (setado antes do import). Ocupa a única vaga do
    // semáforo com uma promise que só resolve depois do teste.
    let releaseInFlight: () => void = () => {}
    const blocker = new Promise<void>((resolve) => {
      releaseInFlight = resolve
    })
    publishResendWebhookEmailLogEventMock.mockImplementationOnce(async () => {
      await blocker
      return { messageId: "mid-test" }
    })

    const firstRequest = POST(makeRequest("{}"))
    // Deixa o primeiro request ocupar o semáforo antes do segundo chegar.
    await Promise.resolve()

    const secondResponse = await POST(makeRequest("{}", { ...SVIX_HEADERS, "svix-id": "svix-2" }))

    expect(secondResponse.status).toBe(200)
    expect((secondResponse as unknown as { body: { received: boolean } }).body.received).toBe(true)
    expect(upsertFromProcessingFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        svixId: "svix-2",
        lastError: expect.stringContaining("saturado"),
        failureReason: "semaphore_saturated",
      })
    )

    releaseInFlight()
    await firstRequest
    await lastAfterPromise
  })

  it("publish falha 3x → grava no outbox com failureReason=queue_publish_failed", async () => {
    publishResendWebhookEmailLogEventMock.mockReset()
    upsertFromProcessingFailureMock.mockReset()
    publishResendWebhookEmailLogEventMock.mockRejectedValue(new Error("queue down"))

    const response = await POST(makeRequest("{}"))
    expect(response.status).toBe(200)
    await lastAfterPromise

    expect(publishResendWebhookEmailLogEventMock).toHaveBeenCalledTimes(DEFAULT_PUBLISH_RETRY_ATTEMPTS)
    expect(upsertFromProcessingFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({ svixId: "svix-1", failureReason: "queue_publish_failed" })
    )
  })

  it("publish com sucesso na 2ª tentativa → NÃO grava no outbox", async () => {
    publishResendWebhookEmailLogEventMock.mockReset()
    upsertFromProcessingFailureMock.mockReset()
    publishResendWebhookEmailLogEventMock
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ messageId: "mid-test" })

    const response = await POST(makeRequest("{}"))
    expect(response.status).toBe(200)
    await lastAfterPromise

    expect(publishResendWebhookEmailLogEventMock).toHaveBeenCalledTimes(2)
    expect(upsertFromProcessingFailureMock).not.toHaveBeenCalled()
  })
})
