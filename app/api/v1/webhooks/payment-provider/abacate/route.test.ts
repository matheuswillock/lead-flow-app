import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
// --isolate: os mocks de módulo abaixo valem apenas para este arquivo.

const listConfigs = mock(async (_environment: string) => [
  { provider: "ABACATE_PAY", externalAccountContext: "abacate-production" },
])
mock.module("@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository", () => ({
  PaymentProviderConfigRepository: class {},
  paymentProviderConfigRepository: { list: listConfigs },
}))

const claim = mock(async (_input: unknown) => ({ kind: "claimed" as const, claimToken: "claim-1" }))
const assertClaimActive = mock(async (_input: unknown) => true)
const markProcessed = mock(async (_input: unknown) => undefined)
const markFailed = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/paymentProviderEvent/PaymentProviderEventInboxRepository", () => ({
  paymentProviderEventInboxRepository: { claim, assertClaimActive, markProcessed, markFailed },
}))

const defaultAttempt = {
  id: "attempt-1",
  status: "PENDING",
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  externalAccountContext: "abacate-production",
  ownerType: "PLATFORM_PURCHASE",
  ownerId: "purchase-1",
  tenantId: "tenant-1",
}
let attempt: typeof defaultAttempt = { ...defaultAttempt }
const findAttemptByExternalId = mock(async (_input: unknown) => attempt)
const applyEventWithClaim = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository", () => ({
  paymentProviderSessionRepository: {
    findAttemptByExternalId,
    findAttemptById: mock(async () => null),
    applyEventWithClaim,
  },
}))

const bind = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/paymentProviderIdentity/PaymentProviderIdentityRepository", () => ({
  paymentProviderIdentityRepository: { bind },
}))

const markPaidOnceForProvider = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository", () => ({
  platformPurchaseRepository: { markPaidOnceForProvider },
}))

const graceFindById = mock(async (_id: string): Promise<unknown> => ({ id: "grace-1", status: "pending" }))
const graceMarkConfirmed = mock(async (_input: unknown): Promise<unknown> => ({ id: "grace-1", status: "confirmed" }))
const graceComplete = mock(async (_id: string): Promise<unknown> => ({ id: "grace-1", status: "completed" }))
mock.module("@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository", () => ({
  billingGracePaymentRepository: {
    findById: graceFindById,
    markConfirmed: graceMarkConfirmed,
    completeAndRestoreAccess: graceComplete,
  },
}))

const adhesionPaymentFindById = mock(async (_id: string): Promise<unknown> => ({ id: "adhesion-payment-1", adhesionId: "adhesion-1" }))
mock.module("@/app/api/infra/data/repositories/backofficeAdhesionPayment/BackofficeAdhesionPaymentRepository", () => ({
  backofficeAdhesionPaymentRepository: { findById: adhesionPaymentFindById },
}))

const markPaidFromProvider = mock(async (_adhesionId: string, _input: unknown): Promise<void> => undefined)
mock.module("@/app/api/services/backofficeAdhesion/BackofficeAdhesionService", () => ({
  backofficeAdhesionService: { markPaidFromProvider },
}))

const captureMessage = mock((_message: string, _options?: unknown) => "event-id")
const captureException = mock((_error: unknown, _hint?: unknown) => "event-id")
mock.module("@sentry/nextjs", () => ({ captureMessage, captureException }))

const { POST } = await import("./route")

const ENV_KEYS = [
  "PAYMENT_PROVIDER_ENVIRONMENT",
  "ABACATE_PAY_PRODUCTION_API_KEY",
  "ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET",
  "ABACATE_PAY_PRODUCTION_PUBLIC_KEY",
  "ABACATE_PAY_API_KEY",
  "ABACATE_PAY_WEBHOOK_SECRET",
  "ABACATE_PAY_PUBLIC_KEY",
] as const
const saved: Record<string, string | undefined> = {}

// A confirmação reconsulta o pagamento no Abacate com a nossa API key; o stub devolve o estado remoto.
const originalFetch = globalThis.fetch
let remotePayment = { status: "PAID", amount: 6990 }
const remoteLookup = mock(async (_url: string) => undefined)

beforeEach(() => {
  remotePayment = { status: "PAID", amount: 6990 }
  remoteLookup.mockClear()
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
    await remoteLookup(url.href)
    return new Response(
      JSON.stringify({
        success: true,
        data: { id: url.searchParams.get("id"), status: remotePayment.status, amount: remotePayment.amount },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  }) as typeof fetch
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
  process.env.ABACATE_PAY_PRODUCTION_API_KEY = "prod-api-key"
  process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = "prod-webhook-secret"
  attempt = { ...defaultAttempt }
  for (const fn of [claim, assertClaimActive, markProcessed, markFailed, findAttemptByExternalId, applyEventWithClaim, bind, markPaidOnceForProvider, graceFindById, graceMarkConfirmed, graceComplete, adhesionPaymentFindById, markPaidFromProvider, captureMessage, captureException]) {
    fn.mockClear()
  }
  markPaidFromProvider.mockImplementation(async () => undefined)
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function completedPayload(devMode: boolean) {
  return JSON.stringify({
    id: "evt_prod_1",
    event: "transparent.completed",
    devMode,
    data: { transparent: { id: "pix_char_prod_1", status: "PAID", method: "PIX", amount: 6990 } },
  })
}

function webhookRequest(rawBody: string, query: string) {
  return new Request(`https://app.example.com/api/v1/webhooks/payment-provider/abacate${query}`, {
    method: "POST",
    body: rawBody,
  })
}

describe("POST /api/v1/webhooks/payment-provider/abacate em PRODUCTION", () => {
  it("aceita evento de produção (devMode:false) com o webhookSecret correto e baixa a compra", async () => {
    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ accepted: true, action: "apply" })
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ environment: "PRODUCTION", externalAccountContext: "abacate-production" }))
    expect(markPaidOnceForProvider).toHaveBeenCalledWith({
      id: "purchase-1",
      provider: "ABACATE_PAY",
      externalId: "pix_char_prod_1",
    })
  })

  it("evento forjado: segredo correto mas o Abacate não confirma PAID, então 401 e nenhuma baixa", async () => {
    remotePayment = { status: "EXPIRED", amount: 6990 }

    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(401)
    expect(remoteLookup).toHaveBeenCalledTimes(1)
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })

  it("pagamento ainda pendente no Abacate responde 500 para o Abacate reenviar o evento", async () => {
    remotePayment = { status: "PENDING", amount: 6990 }

    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(500)
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })

  it("valor consultado diferente do evento é rejeitado com 401 e nenhuma baixa", async () => {
    remotePayment = { status: "PAID", amount: 100 }

    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(401)
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })

  it("responde 401 quando o webhookSecret está ausente", async () => {
    const response = await POST(webhookRequest(completedPayload(false), ""))

    expect(response.status).toBe(401)
    expect(claim).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })

  it("responde 401 quando o webhookSecret está errado", async () => {
    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=wrong-secret"))

    expect(response.status).toBe(401)
    expect(claim).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })

  it("rejeita com 401 evento devMode:true em PRODUCTION", async () => {
    const response = await POST(webhookRequest(completedPayload(true), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(401)
    expect(claim).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/webhooks/payment-provider/abacate — owner BACKOFFICE_ADHESION", () => {
  const confirmedRequest = () =>
    webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret")

  beforeEach(() => {
    attempt = { ...defaultAttempt, ownerType: "BACKOFFICE_ADHESION", ownerId: "adhesion-payment-1", tenantId: "adhesion-1" }
  })

  it("CONFIRMED paga a adesão e provisiona a conta pelo pagamento vinculado", async () => {
    const response = await POST(confirmedRequest())

    expect(response.status).toBe(202)
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
    expect(markPaidFromProvider).toHaveBeenCalledTimes(1)
    expect(markPaidFromProvider).toHaveBeenCalledWith(
      "adhesion-1",
      expect.objectContaining({
        providerPaymentId: "pix_char_prod_1",
        adhesionPaymentId: "adhesion-payment-1",
        amountInCents: 6990,
        paidAt: expect.any(Date),
      }),
    )
  })

  it("falha no efeito de domínio responde 500 e o reenvio (tentativa já CONFIRMED) não repete o efeito", async () => {
    markPaidFromProvider.mockImplementation(async () => {
      throw new Error("Supabase Admin indisponível")
    })
    const failed = await POST(confirmedRequest())
    expect(failed.status).toBe(500)
    expect(markPaidFromProvider).toHaveBeenCalledTimes(1)

    // O CAS da tentativa já a levou a CONFIRMED; o reenvio do webhook não passa mais pelo efeito.
    attempt = { ...attempt, status: "CONFIRMED" }
    markPaidFromProvider.mockImplementation(async () => undefined)
    const replay = await POST(confirmedRequest())

    expect(replay.status).toBe(202)
    expect(markPaidFromProvider).toHaveBeenCalledTimes(1)
  })

  it("pagamento da adesão inexistente falha em vez de ser ignorado", async () => {
    adhesionPaymentFindById.mockImplementationOnce(async () => null)

    const response = await POST(confirmedRequest())

    expect(response.status).toBe(500)
    expect(markPaidFromProvider).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/webhooks/payment-provider/abacate — owner BILLING_GRACE_PAYMENT e desconhecido", () => {
  const confirmedRequest = () =>
    webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret")

  it("regularização confirmada restaura o acesso", async () => {
    attempt = { ...defaultAttempt, ownerType: "BILLING_GRACE_PAYMENT", ownerId: "grace-1" }

    const response = await POST(confirmedRequest())

    expect(response.status).toBe(202)
    expect(graceMarkConfirmed).toHaveBeenCalledWith(expect.objectContaining({ id: "grace-1", providerExternalId: "pix_char_prod_1" }))
    expect(graceComplete).toHaveBeenCalledWith("grace-1")
  })

  it("ownerType desconhecido gera alerta estruturado em vez de passar em silêncio", async () => {
    attempt = { ...defaultAttempt, ownerType: "ALGUM_OWNER_NOVO", ownerId: "x-1" }

    const response = await POST(confirmedRequest())

    expect(response.status).toBe(202)
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]?.[1]).toMatchObject({
      level: "error",
      tags: { ownerType: "ALGUM_OWNER_NOVO" },
    })
    expect(markPaidFromProvider).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/webhooks/payment-provider/abacate — o segredo da query nunca deixa rastro", () => {
  const SENTINEL = "SENTINELA_SEGREDO"
  const sentinelUrl = `https://app.example.com/api/v1/webhooks/payment-provider/abacate?webhookSecret=${SENTINEL}`
  const consoleError = mock((..._args: unknown[]) => undefined)
  const originalConsoleError = console.error

  beforeEach(() => {
    consoleError.mockClear()
    console.error = consoleError
    process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = SENTINEL
    attempt = { ...defaultAttempt, ownerType: "BACKOFFICE_ADHESION", ownerId: "adhesion-payment-1", tenantId: "adhesion-1" }
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  const failingRequest = () =>
    new Request(sentinelUrl, { method: "POST", body: completedPayload(false) })

  it("erro 500 vai ao Sentry com provider e id do evento, sem a sentinela no console nem no Sentry", async () => {
    // Pior caso: a mensagem do erro carrega a URL inteira (cliente HTTP, proxy, wrapper).
    markPaidFromProvider.mockImplementation(async () => {
      throw new Error(`falha ao chamar ${sentinelUrl}`)
    })

    const response = await POST(failingRequest())

    expect(response.status).toBe(500)
    expect(captureException).toHaveBeenCalledTimes(1)
    const [captured, hint] = captureException.mock.calls[0] ?? []
    expect(hint).toMatchObject({ tags: { provider: "ABACATE_PAY" }, extra: { eventId: "evt_prod_1" } })
    expect(JSON.stringify(hint)).not.toContain(SENTINEL)
    expect(captured).toBeInstanceOf(Error)
    expect(`${(captured as Error).message}\n${(captured as Error).stack}`).not.toContain(SENTINEL)
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(SENTINEL)
  })

  it("corpo que não é JSON responde 401 sem captura e sem a sentinela no console", async () => {
    const response = await POST(new Request(sentinelUrl, { method: "POST", body: "não é json" }))

    expect(response.status).toBe(401)
    expect(captureException).not.toHaveBeenCalled()
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(SENTINEL)
  })

  it("401 (segredo inválido) não vai ao Sentry: é ruído de scanner e já fica no log estruturado", async () => {
    const response = await POST(
      new Request(`${sentinelUrl}_ERRADO`, { method: "POST", body: completedPayload(false) }),
    )

    expect(response.status).toBe(401)
    expect(captureException).not.toHaveBeenCalled()
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(SENTINEL)
  })

  it("toda resposta (202, 401, 500) traz Referrer-Policy e Cache-Control e nunca redireciona", async () => {
    const accepted = await POST(failingRequest())
    markPaidFromProvider.mockImplementation(async () => {
      throw new Error("Supabase Admin indisponível")
    })
    const failed = await POST(failingRequest())
    const unauthorized = await POST(webhookRequest(completedPayload(false), "?webhookSecret=errado"))

    expect([accepted.status, failed.status, unauthorized.status]).toEqual([202, 500, 401])
    for (const response of [accepted, failed, unauthorized]) {
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer")
      expect(response.headers.get("Cache-Control")).toBe("no-store")
      expect(response.headers.get("Location")).toBeNull()
    }
  })
})
