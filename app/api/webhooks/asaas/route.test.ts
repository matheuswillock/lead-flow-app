import { describe, expect, it, mock } from "bun:test"
import { DEFAULT_PUBLISH_RETRY_ATTEMPTS } from "@/lib/queues/publish-with-retry"

const claimForProcessingMock = mock(
  async (): Promise<"process" | "already_processed" | "already_processing"> => "process"
)
const markFailedMock = mock(async () => {})
const markProcessedMock = mock(async () => {})
const processAsaasWebhookEventMock = mock(async () => {})
const publishAsaasWebhookEventMock = mock(async () => ({ messageId: "mid-test" }))

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

mock.module("@sentry/nextjs", () => ({
  captureException: mock(() => {}),
}))

mock.module("@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository", () => ({
  asaasWebhookEventRepository: {
    claimForProcessing: claimForProcessingMock,
    markFailed: markFailedMock,
    markProcessed: markProcessedMock,
  },
}))

mock.module("./processAsaasWebhookEvent", () => ({
  processAsaasWebhookEvent: processAsaasWebhookEventMock,
  resolveAsaasWebhookEventId: (body: {
    id?: string
    event?: string
    payment?: { id?: string }
    subscription?: { id?: string }
  }) => {
    const explicitId = typeof body.id === "string" ? body.id.trim() : ""
    if (explicitId) return explicitId
    const paymentId = body.payment?.id
    const subscriptionId = body.subscription?.id
    const event = body.event ?? "unknown"
    if (paymentId) return `${event}:payment:${paymentId}`
    if (subscriptionId) return `${event}:subscription:${subscriptionId}`
    return `${event}:test`
  },
}))

mock.module("@/lib/queues/asaas-webhook-events", () => ({
  publishAsaasWebhookEvent: publishAsaasWebhookEventMock,
}))

process.env.ASAAS_ENV = "sandbox"
process.env.ASAAS_WEBHOOK_TOKEN = "test-token"

const { POST } = await import("./route")

const VALID_BODY = {
  id: "evt-1",
  event: "PAYMENT_RECEIVED",
  payment: { id: "pay-1", status: "RECEIVED" },
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { "asaas-access-token": "test-token" }
) {
  return new Request("http://localhost/api/webhooks/asaas", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  }) as unknown as import("next/server").NextRequest
}

function resetMocks() {
  claimForProcessingMock.mockReset()
  claimForProcessingMock.mockResolvedValue("process")
  markFailedMock.mockReset()
  markFailedMock.mockResolvedValue(undefined)
  markProcessedMock.mockReset()
  processAsaasWebhookEventMock.mockReset()
  publishAsaasWebhookEventMock.mockReset()
  publishAsaasWebhookEventMock.mockResolvedValue({ messageId: "mid-test" })
}

describe("Asaas webhook route", () => {
  it("token ausente → 401, sem chamar claimForProcessing", async () => {
    resetMocks()

    const response = await POST(makeRequest(VALID_BODY, {}))

    expect(response.status).toBe(401)
    expect(claimForProcessingMock).not.toHaveBeenCalled()
  })

  it("token inválido → 401", async () => {
    resetMocks()

    const response = await POST(
      makeRequest(VALID_BODY, { "asaas-access-token": "wrong-token" })
    )

    expect(response.status).toBe(401)
  })

  it("token inválido de mesmo comprimento do esperado → 401 (T-10.7)", async () => {
    resetMocks()

    // "test-token" tem 10 caracteres; "test-tokeX" também.
    const response = await POST(
      makeRequest(VALID_BODY, { "asaas-access-token": "test-tokeX" })
    )

    expect(response.status).toBe(401)
    expect(claimForProcessingMock).not.toHaveBeenCalled()
  })

  it("payment sem ID → 200 com mensagem ignorado, sem chamar claimForProcessing", async () => {
    resetMocks()

    const response = await POST(
      makeRequest({
        event: "PAYMENT_RECEIVED",
        payment: { status: "RECEIVED" },
      })
    )

    expect(response.status).toBe(200)
    expect(
      (response as unknown as { body: { message: string } }).body.message
    ).toMatch(/ignorado/i)
    expect(claimForProcessingMock).not.toHaveBeenCalled()
  })

  it("evento já processado → 200, sem publicar na fila", async () => {
    resetMocks()
    claimForProcessingMock.mockResolvedValue("already_processed")

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(200)
    await Promise.resolve()
    expect(publishAsaasWebhookEventMock).not.toHaveBeenCalled()
  })

  it("fluxo feliz: claim process → publica na fila e não marca failed", async () => {
    resetMocks()
    claimForProcessingMock.mockResolvedValue("process")

    const response = await POST(makeRequest(VALID_BODY))
    expect(response.status).toBe(200)
    await lastAfterPromise

    expect(publishAsaasWebhookEventMock).toHaveBeenCalledWith({
      eventId: "evt-1",
      body: VALID_BODY,
      account: "primary",
    })
    expect(markFailedMock).not.toHaveBeenCalled()
  })

  it("claimForProcessing recebe account resolvido (M3.1/M3.3 — E4/T-10.9)", async () => {
    resetMocks()
    claimForProcessingMock.mockResolvedValue("process")

    await POST(makeRequest(VALID_BODY))

    expect(claimForProcessingMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt-1", account: "primary" })
    )
  })

  it("token da conta legacy (quando configurada) → account=legacy", async () => {
    resetMocks()
    process.env.ASAAS_LEGACY_API_KEY = "aact_legacy_key"
    process.env.ASAAS_LEGACY_WEBHOOK_TOKEN = "legacy-token"

    try {
      const response = await POST(
        makeRequest(VALID_BODY, { "asaas-access-token": "legacy-token" })
      )

      expect(response.status).toBe(200)
      expect(claimForProcessingMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "evt-1", account: "legacy" })
      )
    } finally {
      delete process.env.ASAAS_LEGACY_API_KEY
      delete process.env.ASAAS_LEGACY_WEBHOOK_TOKEN
    }
  })

  it("publish falha 3x → after resolve, markFailed com queue_publish_failed", async () => {
    resetMocks()
    claimForProcessingMock.mockResolvedValue("process")
    publishAsaasWebhookEventMock.mockRejectedValue(new Error("queue down"))

    const response = await POST(makeRequest(VALID_BODY))
    expect(response.status).toBe(200)
    await lastAfterPromise

    expect(publishAsaasWebhookEventMock).toHaveBeenCalledTimes(DEFAULT_PUBLISH_RETRY_ATTEMPTS)
    expect(markFailedMock).toHaveBeenCalledWith(
      "evt-1",
      "queue down",
      "queue_publish_failed"
    )
  })
})
