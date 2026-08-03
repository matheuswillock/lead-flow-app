import { describe, expect, it, mock } from "bun:test"
import { createHmac } from "node:crypto"

const findConfigByWebhookSecret = mock(async (_token: string) => null as null | {
  id: string
  teamId: string
})
const persistWebhookEvent = mock(async () => "evt-1")
const processOutbox = mock(async () => ({ isValid: true, errorMessages: [], result: {} }))

mock.module("next/server", () => {
  class NextResponse {
    status: number
    constructor(body: unknown, init?: { status?: number }) {
      void body
      this.status = init?.status ?? 200
    }
    static json(body: unknown, init?: { status?: number }) {
      return new NextResponse(body, init)
    }
  }
  return {
    NextResponse,
    after: (fn: () => unknown) => {
      void Promise.resolve().then(fn)
    },
  }
})

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {
    findConfigByWebhookSecret,
    persistWebhookEvent,
  },
}))

mock.module("@/app/api/useCases/whatsapp/ProcessWhatsAppWebhookOutboxUseCase", () => ({
  processWhatsAppWebhookOutboxUseCase: {
    process: processOutbox,
  },
}))

mock.module("@sentry/nextjs", () => ({
  captureMessage: mock(() => {}),
  captureException: mock(() => {}),
}))

mock.module("@/lib/whatsapp/whatsapp-webhook-failure-alert", () => ({
  recordWhatsAppWebhookProcessingFailure: mock(async () => {}),
  recordWhatsAppWebhookProcessingSuccess: mock(async () => {}),
}))

mock.module("@/lib/http/rethrow-if-prerender-interrupted", () => ({
  rethrowIfPrerenderInterrupted: mock(() => {}),
}))

const { POST } = await import("./route")

const SECRET = "s".repeat(32)
const TEAM_TOKEN = "tok-abc"

function sign(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`
}

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/webhooks/whatsapp/openwa/${TEAM_TOKEN}`, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  }) as unknown as import("next/server").NextRequest
}

describe("OpenWa webhook route", () => {
  it("retorna 401 quando teamToken inexistente", async () => {
    findConfigByWebhookSecret.mockImplementation(async () => null)
    const body = "{}"
    process.env.OPENWA_WEBHOOK_SECRET = SECRET
    const res = await POST(makeRequest(body, { "x-openwa-signature": sign(body) }), {
      params: Promise.resolve({ teamToken: TEAM_TOKEN }),
    })
    expect(res.status).toBe(401)
    expect(persistWebhookEvent).not.toHaveBeenCalled()
  })

  it("retorna 401 para HMAC inválido sem persistir", async () => {
    findConfigByWebhookSecret.mockImplementation(async () => ({
      id: "cfg-1",
      teamId: "team-1",
    }))
    process.env.OPENWA_WEBHOOK_SECRET = SECRET
    persistWebhookEvent.mockClear()
    const body = JSON.stringify({ event: "ready" })
    const res = await POST(makeRequest(body, { "x-openwa-signature": "sha256=deadbeef" }), {
      params: Promise.resolve({ teamToken: TEAM_TOKEN }),
    })
    expect(res.status).toBe(401)
    expect(persistWebhookEvent).not.toHaveBeenCalled()
  })

  it("retorna 400 para JSON inválido", async () => {
    findConfigByWebhookSecret.mockImplementation(async () => ({
      id: "cfg-1",
      teamId: "team-1",
    }))
    process.env.OPENWA_WEBHOOK_SECRET = SECRET
    const body = "{not-json"
    const res = await POST(makeRequest(body, { "x-openwa-signature": sign(body) }), {
      params: Promise.resolve({ teamToken: TEAM_TOKEN }),
    })
    expect(res.status).toBe(400)
  })

  it("HMAC ok → 200 e persiste evento", async () => {
    findConfigByWebhookSecret.mockImplementation(async () => ({
      id: "cfg-1",
      teamId: "team-1",
    }))
    process.env.OPENWA_WEBHOOK_SECRET = SECRET
    persistWebhookEvent.mockClear()
    const body = JSON.stringify({ instance: "i", event: "ready", data: {}, timestamp: 1 })
    const res = await POST(makeRequest(body, { "x-openwa-signature": sign(body) }), {
      params: Promise.resolve({ teamToken: TEAM_TOKEN }),
    })
    expect(res.status).toBe(200)
    expect(persistWebhookEvent).toHaveBeenCalled()
  })
})
