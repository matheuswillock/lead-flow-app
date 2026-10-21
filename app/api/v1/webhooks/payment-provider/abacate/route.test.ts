import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
// --isolate: os mocks de módulo abaixo valem apenas para este arquivo.

const listConfigs = mock(async (_environment: string) => [
  { provider: "ABACATE_PAY", externalAccountContext: "abacate-production" },
])
mock.module("@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository", () => ({
  PaymentProviderConfigRepository: class {},
  // findPrimary/findByScope: o resolver de credenciais (M11) consulta a instância; sem linha, vale o ambiente.
  paymentProviderConfigRepository: { list: listConfigs, findPrimary: async () => null, findByScope: async () => null },
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
const purchaseFindById = mock(async (_id: string): Promise<unknown> => ({
  id: "purchase-1",
  amount: "69.90",
  billingType: "PIX",
  purchaseType: "subscription",
  productSlug: "plano",
}))
const applyEmailCredits = mock(async (_input: unknown) => ({ handled: true, applied: true, alreadyApplied: false }))
mock.module("@/app/api/useCases/email/ApplyEmailCreditsPaidPurchaseUseCase", () => ({
  applyEmailCreditsPaidPurchaseUseCase: { apply: applyEmailCredits },
}))
const sendSlack = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/services/backofficeCronSlack/BackofficeCronSlackNotificationService", () => ({
  backofficeCronSlackNotificationService: { sendFailureAlertBestEffort: sendSlack },
}))
mock.module("@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository", () => ({
  platformPurchaseRepository: { markPaidOnceForProvider, findById: purchaseFindById },
}))

const graceFindById = mock(async (_id: string): Promise<unknown> => ({ id: "grace-1", status: "pending", amountCents: 6990 }))
const graceMarkConfirmed = mock(async (_input: unknown): Promise<unknown> => ({ id: "grace-1", status: "confirmed" }))
const graceComplete = mock(async (_id: string): Promise<unknown> => ({ id: "grace-1", status: "completed" }))
mock.module("@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository", () => ({
  billingGracePaymentRepository: {
    findById: graceFindById,
    markConfirmed: graceMarkConfirmed,
    completeAndRestoreAccess: graceComplete,
  },
}))

const adhesionPaymentFindById = mock(async (_id: string): Promise<unknown> => ({ id: "adhesion-payment-1", adhesionId: "adhesion-1", amountCents: 6990 }))
mock.module("@/app/api/infra/data/repositories/backofficeAdhesionPayment/BackofficeAdhesionPaymentRepository", () => ({
  backofficeAdhesionPaymentRepository: { findById: adhesionPaymentFindById },
}))

const markPaidFromProvider = mock(async (_adhesionId: string, _input: unknown): Promise<void> => undefined)
mock.module("@/app/api/services/backofficeAdhesion/BackofficeAdhesionService", () => ({
  backofficeAdhesionService: { markPaidFromProvider },
}))

const captureMessage = mock((_message: string, _options?: unknown) => "event-id")
const captureException = mock((_error: unknown, _options?: unknown) => "event-id")
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

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
  process.env.ABACATE_PAY_PRODUCTION_API_KEY = "prod-api-key"
  process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = "prod-webhook-secret"
  attempt = { ...defaultAttempt }
  for (const fn of [claim, assertClaimActive, markProcessed, markFailed, findAttemptByExternalId, applyEventWithClaim, bind, markPaidOnceForProvider, graceFindById, graceMarkConfirmed, graceComplete, adhesionPaymentFindById, markPaidFromProvider, captureMessage, captureException, purchaseFindById, applyEmailCredits, sendSlack]) {
    fn.mockClear()
  }
  markPaidFromProvider.mockImplementation(async () => undefined)
})

afterEach(() => {
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

    // O guard de valor/método (T011) barra antes de qualquer efeito.
    expect(response.status).toBe(422)
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

describe("POST /api/v1/webhooks/payment-provider/abacate — nenhum rastro do segredo (PAY-HARD-T012B)", () => {
  const SECRET = "prod-webhook-secret"
  const request = () => webhookRequest(completedPayload(false), `?webhookSecret=${SECRET}`)

  it("erro forçado com a URL na mensagem: log e evento do Sentry saem sem o segredo, com provider e id do evento", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined)
    claim.mockImplementationOnce(async () => {
      throw new Error(`fetch failed https://app.example.com/api/v1/webhooks/payment-provider/abacate?webhookSecret=${SECRET}`)
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(captureException).toHaveBeenCalledTimes(1)
    const sentryPayload = JSON.stringify(captureException.mock.calls)
    expect(sentryPayload).not.toContain(SECRET)
    expect(sentryPayload).toContain("ABACATE_PAY")
    expect(sentryPayload).toContain("evt_prod_1")
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(SECRET)
    consoleError.mockRestore()
  })

  it("segredo inválido (401) também não vai ao log e não gera evento de erro no Sentry", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined)

    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=wrong-secret-xyz"))

    expect(response.status).toBe(401)
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("wrong-secret-xyz")
    expect(captureException).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it.each([
    ["sucesso", () => request(), 202],
    ["segredo errado", () => webhookRequest(completedPayload(false), "?webhookSecret=x"), 401],
  ])("responde %s sem redirecionamento e com Referrer-Policy no-referrer", async (_name, build, status) => {
    const response = await POST(build())

    expect(response.status).toBe(status)
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("location")).toBeNull()
  })
})

describe("POST /api/v1/webhooks/payment-provider/abacate — assinatura HMAC", () => {
  it("com chave pública configurada, evento sem X-Webhook-Signature responde 401 mesmo com o segredo correto", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_prod_key"

    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(401)
    expect(claim).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/webhooks/payment-provider/abacate — valor e método contra a tentativa (PAY-HARD-T011)", () => {
  const payload = (amount: number, method = "PIX") =>
    JSON.stringify({
      id: "evt_mismatch",
      event: "transparent.completed",
      devMode: false,
      data: { transparent: { id: "pix_char_prod_1", status: "PAID", method, amount } },
    })
  const request = (body: string) => webhookRequest(body, "?webhookSecret=prod-webhook-secret")

  it.each([
    ["PLATFORM_PURCHASE", "purchase-1"],
    ["BACKOFFICE_ADHESION", "adhesion-payment-1"],
    ["BILLING_GRACE_PAYMENT", "grace-1"],
  ])("%s: valor divergente é rejeitado sem nenhum efeito e a inbox registra a falha", async (ownerType, ownerId) => {
    attempt = { ...defaultAttempt, ownerType, ownerId, tenantId: "adhesion-1" }

    const response = await POST(request(payload(100)))

    expect(response.status).toBe(422)
    expect(applyEventWithClaim).not.toHaveBeenCalled()
    expect(bind).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
    expect(markPaidFromProvider).not.toHaveBeenCalled()
    expect(graceMarkConfirmed).not.toHaveBeenCalled()
    expect(applyEmailCredits).not.toHaveBeenCalled()
    expect(markFailed).toHaveBeenCalledTimes(1)
    expect(sendSlack).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["PLATFORM_PURCHASE", "purchase-1"],
    ["BACKOFFICE_ADHESION", "adhesion-payment-1"],
    ["BILLING_GRACE_PAYMENT", "grace-1"],
  ])("%s: método divergente é rejeitado sem efeito", async (ownerType, ownerId) => {
    attempt = { ...defaultAttempt, ownerType, ownerId, tenantId: "adhesion-1" }

    const response = await POST(request(payload(6990, "CARD")))

    expect(response.status).toBe(422)
    expect(applyEventWithClaim).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
    expect(markPaidFromProvider).not.toHaveBeenCalled()
    expect(graceMarkConfirmed).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/webhooks/payment-provider/abacate — disputa e créditos", () => {
  const disputedBody = JSON.stringify({
    id: "evt_disputed_1",
    event: "transparent.disputed",
    devMode: false,
    data: { transparent: { id: "pix_char_prod_1", status: "UNDER_DISPUTE", method: "PIX", amount: 6990 } },
  })
  const request = (body: string) => webhookRequest(body, "?webhookSecret=prod-webhook-secret")

  it("transparent.disputed marca DISPUTED e alerta Slack e Sentry com o id da cobrança, sem reembolso", async () => {
    attempt = { ...defaultAttempt, status: "CONFIRMED" }

    const response = await POST(request(disputedBody))

    expect(response.status).toBe(202)
    expect(applyEventWithClaim).toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "DISPUTED" }))
    expect(sendSlack).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(sendSlack.mock.calls[0])).toContain("pix_char_prod_1")
    expect(JSON.stringify(captureMessage.mock.calls)).toContain("pix_char_prod_1")
  })

  it("compra de créditos de e-mail confirmada aplica os créditos no próprio webhook", async () => {
    purchaseFindById.mockImplementation(async () => ({
      id: "purchase-1",
      amount: "69.90",
      billingType: "PIX",
      purchaseType: "email_credits",
      productSlug: "email-credits-starter",
    }))
    try {
      const response = await POST(request(completedPayload(false)))

      expect(response.status).toBe(202)
      expect(applyEmailCredits).toHaveBeenCalledWith({
        paymentId: "pix_char_prod_1",
        checkoutId: "purchase-1",
        productSlug: "email-credits-starter",
      })
    } finally {
      purchaseFindById.mockImplementation(async () => ({
        id: "purchase-1",
        amount: "69.90",
        billingType: "PIX",
        purchaseType: "subscription",
        productSlug: "plano",
      }))
    }
  })
})
