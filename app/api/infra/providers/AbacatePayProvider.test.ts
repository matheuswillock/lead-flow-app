import { createHmac } from "node:crypto"
import { describe, expect, it, mock } from "bun:test"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import type { VerifiedWebhook } from "@/lib/payment-provider/contracts"
import { AbacatePayProvider } from "./AbacatePayProvider"

const config = PaymentProviderConfig.create({
  apiKey: "sk_test_provider",
  publicKey: "pk_test_provider",
  webhookSecret: "webhook-secret",
  webhookSigningKey: "hmac-secret",
  environment: "DEV",
  devMode: true,
})

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function creationRequestBody(http: ReturnType<typeof mock>): Record<string, unknown> & {
  data: Record<string, unknown>
} {
  const calls = http.mock.calls as unknown as Array<[string, RequestInit | undefined]>
  const init = calls[0]?.[1]
  const parsed = JSON.parse(String(init?.body)) as Record<string, unknown>
  return parsed as Record<string, unknown> & { data: Record<string, unknown> }
}

const customer = {
  name: "Cliente Teste",
  email: "cliente@example.com",
  taxId: "12345678909",
  cellphone: "11999999999",
}

// Mint a verified webhook for isolated normalization tests. Production code can
// only obtain one through AbacatePayProvider.verifyRequest.
function verifiedWebhook(provider: AbacatePayProvider, rawBody: string): VerifiedWebhook {
  const signature = createHmac("sha256", "hmac-secret").update(rawBody).digest("base64")
  return provider.verifyRequest({
    rawBody,
    signature,
    query: { webhookSecret: "webhook-secret" },
  })
}

describe("AbacatePayProvider", () => {
  it("cria PIX normalizado sem devolver URL hospedada", async () => {
    const http = mock(async () =>
      response({
        data: {
          id: "pay_pix",
          status: "PENDING",
          amount: 1250,
          brCode: "000201",
          brCodeBase64: "base64",
          expiresAt: "2026-10-20T12:00:00Z",
          url: "https://provider.invalid",
        },
      }),
    )
    const provider = new AbacatePayProvider(config, { http })

    const result = await provider.createPixPayment({ amountInCents: 1250, customer })

    expect(result).toEqual({
      externalId: "pay_pix",
      method: "PIX",
      status: "PENDING",
      amountInCents: 1250,
      currency: "BRL",
      pix: { brCode: "000201", brCodeBase64: "base64", expiresAt: "2026-10-20T12:00:00Z" },
    })
    if (result.status !== "UNKNOWN") {
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.pix)).toBe(true)
    }
    expect(http).toHaveBeenCalledWith(
      "https://api.abacatepay.com/v2/transparents/create",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer sk_test_provider" }),
      }),
    )
  })

  it("declara somente as capabilities do pagamento único transparente", () => {
    const provider = new AbacatePayProvider(config)

    expect(provider.metadata).toEqual({
      key: "ABACATE_PAY",
      environment: "DEV",
      capabilities: ["PIX", "HOSTED_CHECKOUT", "CARD", "STATUS_QUERY", "FULL_REFUND", "WEBHOOK"],
    })
  })

  it("cria checkout hospedado usando produto avulso com o valor congelado", async () => {
    const http = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/products/list")) {
        return response({ data: [{ id: "prod_grace", externalId: "billing-grace-dev-1250", price: 1250, status: "ACTIVE" }] })
      }
      return response({ data: { id: "bill_grace", url: "https://app.abacatepay.com/pay/bill_grace", amount: 1250 } })
    })
    const provider = new AbacatePayProvider(config, { http })

    const result = await provider.createHostedCheckout({
      amountInCents: 1250,
      externalReference: "payment-attempt",
      metadata: { attemptId: "attempt-1" },
      returnUrl: "https://app.example.com/return",
      completionUrl: "https://app.example.com/complete",
    })

    expect(result).toEqual({
      externalId: "bill_grace",
      url: "https://app.abacatepay.com/pay/bill_grace",
      amountInCents: 1250,
      status: "PENDING",
    })
    expect(http).toHaveBeenCalledWith(
      "https://api.abacatepay.com/v2/checkouts/create",
      expect.objectContaining({ body: expect.stringContaining('"methods":["PIX"]') }),
    )
  })

  it("normaliza checkout.completed como pagamento confirmado", () => {
    const provider = new AbacatePayProvider(config)
    const rawBody = JSON.stringify({
      id: "evt_checkout",
      event: "checkout.completed",
      devMode: true,
      data: {
        checkout: {
          id: "bill_grace",
          status: "PAID",
          amount: 1250,
          metadata: { attemptId: "11111111-1111-4111-8111-111111111111" },
          updatedAt: "2026-10-20T12:00:00.000Z",
        },
      },
    })

    const result = provider.normalizeEvent(verifiedWebhook(provider, rawBody))

    expect(result).toMatchObject({
      event: "PAYMENT_CONFIRMED",
      externalPaymentId: "bill_grace",
      status: "CONFIRMED",
      method: "PIX",
      attemptId: "11111111-1111-4111-8111-111111111111",
    })
  })

  it("envia a criação PIX no envelope data do contrato do provider", async () => {
    const http = mock(async () =>
      response({
        data: {
          id: "pay_pix",
          status: "PENDING",
          amount: 1250,
          brCode: "000201",
          brCodeBase64: "base64",
          expiresAt: "2026-10-20T12:00:00Z",
        },
      }),
    )
    const provider = new AbacatePayProvider(config, { http })

    await provider.createPixPayment({
      amountInCents: 1250,
      customer,
      externalReference: "attempt_pix",
      metadata: { paymentAttemptId: "attempt_pix", sessionId: "sess_1" },
    })

    const body = creationRequestBody(http)
    expect(body.method).toBe("PIX")
    expect(body.data).toEqual({
      amount: 1250,
      customer,
      externalId: "attempt_pix",
      metadata: { paymentAttemptId: "attempt_pix", sessionId: "sess_1" },
    })
    expect(body).not.toHaveProperty("amount")
    expect(body).not.toHaveProperty("customer")
  })

  it("envia a criação CARD no envelope data com installmentCount e sem externalId", async () => {
    const http = mock(async () =>
      response({ data: { id: "pay_card", status: "APPROVED", amount: 12000 } }),
    )
    const provider = new AbacatePayProvider(config, {
      http,
      now: () => new Date("2026-10-20T12:00:30Z"),
    })

    await provider.createCardPayment({
      amountInCents: 12000,
      customer,
      token: "ctok_valid",
      tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
      installments: 3,
      externalReference: "attempt_card",
      metadata: { paymentAttemptId: "attempt_card" },
    })

    const body = creationRequestBody(http)
    expect(body.method).toBe("CARD")
    expect(body.data).toEqual({
      amount: 12000,
      customer,
      token: "ctok_valid",
      installmentCount: 3,
      metadata: { paymentAttemptId: "attempt_card" },
    })
    expect(body.data).not.toHaveProperty("externalId")
    expect(body.data).not.toHaveProperty("installments")
  })

  it("envia installmentCount 1 quando o cartão é à vista", async () => {
    const http = mock(async () =>
      response({ data: { id: "pay_card", status: "APPROVED", amount: 12000 } }),
    )
    const provider = new AbacatePayProvider(config, {
      http,
      now: () => new Date("2026-10-20T12:00:30Z"),
    })

    await provider.createCardPayment({
      amountInCents: 12000,
      customer,
      token: "ctok_valid",
      tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
    })

    expect(creationRequestBody(http).data.installmentCount).toBe(1)
  })

  it("descarta cardToken devolvido pela criação de cartão", async () => {
    const http = mock(async () =>
      response({
        data: { id: "pay_card", status: "APPROVED", amount: 12000, cardToken: "ctok_leaked" },
      }),
    )
    const provider = new AbacatePayProvider(config, {
      http,
      now: () => new Date("2026-10-20T12:00:30Z"),
    })

    const result = await provider.createCardPayment({
      amountInCents: 12000,
      customer,
      token: "ctok_valid",
      tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
    })

    expect(result).not.toHaveProperty("cardToken")
    expect(JSON.stringify(result)).not.toContain("ctok_leaked")
  })

  it("lê o segredo do webhook somente da query webhookSecret", () => {
    const provider = new AbacatePayProvider(config)
    const rawBody = JSON.stringify({
      id: "evt_1",
      event: "transparent.completed",
      devMode: true,
      data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1500 },
    })
    const signature = createHmac("sha256", "hmac-secret").update(rawBody).digest("base64")

    expect(
      provider.verifyRequest({ rawBody, signature, query: { webhookSecret: "webhook-secret" } })
        .environment,
    ).toBe("DEV")
    expect(() =>
      provider.verifyRequest({ rawBody, signature, query: { secret: "webhook-secret" } }),
    ).toThrow("Webhook não autenticado")
  })

  it("classifica timeout durante criação como UNKNOWN e exige reconciliação", async () => {
    const http = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      throw Object.assign(new Error("socket timeout"), { name: "TimeoutError" })
    })
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.createPixPayment({
        amountInCents: 1250,
        customer,
        externalReference: "attempt_timeout",
      }),
    ).resolves.toEqual({
      status: "UNKNOWN",
      externalId: null,
      reconciliationReference: "attempt_timeout",
      reason: "REMOTE_TIMEOUT",
      requiresReconciliation: true,
    })
  })

  it("classifica erro remoto retryable durante criação como UNKNOWN", async () => {
    const http = mock(async () => response({ code: "TEMPORARY_FAILURE" }, 503))
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.createPixPayment({
        amountInCents: 1250,
        customer,
        externalReference: "attempt_503",
      }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "REMOTE_ERROR",
      reconciliationReference: "attempt_503",
      requiresReconciliation: true,
    })
  })

  it("classifica timeout durante criação de cartão como UNKNOWN", async () => {
    const http = mock(async () => {
      throw Object.assign(new Error("socket timeout"), { name: "TimeoutError" })
    })
    const provider = new AbacatePayProvider(config, {
      http,
      now: () => new Date("2026-10-20T12:00:30Z"),
    })

    await expect(
      provider.createCardPayment({
        amountInCents: 12000,
        customer,
        token: "ctok_valid",
        tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
        externalReference: "attempt_card_timeout",
      }),
    ).resolves.toEqual({
      status: "UNKNOWN",
      externalId: null,
      reconciliationReference: "attempt_card_timeout",
      reason: "REMOTE_TIMEOUT",
      requiresReconciliation: true,
    })
  })

  it("classifica HTTP 408 durante criação como UNKNOWN", async () => {
    const http = mock(async () => response({ code: "REQUEST_TIMEOUT" }, 408))
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.createPixPayment({ amountInCents: 1250, customer }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "REMOTE_ERROR",
      requiresReconciliation: true,
    })
  })

  it("classifica falha de transporte não-timeout durante criação como UNKNOWN", async () => {
    const http = mock(async () => {
      throw new TypeError("socket reset")
    })
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.createPixPayment({ amountInCents: 1250, customer }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "REMOTE_ERROR",
      requiresReconciliation: true,
    })
  })

  it("classifica timeout durante consulta como UNKNOWN e exige reconciliação", async () => {
    const http = mock(async () => {
      throw Object.assign(new Error("socket timeout"), { name: "TimeoutError" })
    })
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.getStatus({ externalId: "pay_timeout", method: "PIX" }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      externalId: "pay_timeout",
      reason: "REMOTE_TIMEOUT",
      requiresReconciliation: true,
    })
  })

  it("classifica erro retryable de consulta como UNKNOWN com reason correto", async () => {
    const http = mock(async () => response({ code: "TEMPORARY_FAILURE" }, 503))
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.getStatus({ externalId: "pay_retryable", method: "PIX" }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "REMOTE_ERROR",
      requiresReconciliation: true,
    })
  })

  it("rejeita ID retornado divergente e reconcilia ID ausente", async () => {
    const mismatchHttp = mock(async () =>
      response({ data: { id: "pay_other", status: "PAID", amount: 1250 } }),
    )
    const mismatchProvider = new AbacatePayProvider(config, { http: mismatchHttp })
    await expect(
      mismatchProvider.getStatus({ externalId: "pay_expected", method: "PIX" }),
    ).rejects.toThrow("ID externo divergente")

    const missingIdHttp = mock(async () => response({ data: { status: "PAID", amount: 1250 } }))
    const missingIdProvider = new AbacatePayProvider(config, { http: missingIdHttp })
    await expect(
      missingIdProvider.getStatus({ externalId: "pay_missing", method: "PIX" }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      externalId: "pay_missing",
      reason: "MISSING_EXTERNAL_ID",
      requiresReconciliation: true,
    })
  })

  it("rejeita identificador de consulta vazio", async () => {
    const provider = new AbacatePayProvider(config, {
      http: mock(async () => response({ data: {} })),
    })

    await expect(provider.getStatus({ externalId: " ", method: "PIX" })).rejects.toThrow(
      "ID externo",
    )
  })

  it("rejeita método e identificadores não canônicos em runtime", async () => {
    const http = mock(async () => response({ data: {} }))
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.getStatus({ externalId: "pay_1", method: "BOLETO" as "PIX" }),
    ).rejects.toThrow("método")
    await expect(provider.getStatus({ externalId: " pay_1 ", method: "PIX" })).rejects.toThrow(
      "ID externo",
    )
    await expect(provider.refundFull({ externalId: " pay_1 " })).rejects.toThrow("ID externo")
    expect(http).not.toHaveBeenCalled()
  })

  it("rejeita webhook sem event id ou sem pagamento externo associável", () => {
    const provider = new AbacatePayProvider(config)
    const emptyEventId = JSON.stringify({
      id: "",
      event: "transparent.completed",
      devMode: true,
      data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1250 },
    })
    const missingPaymentId = JSON.stringify({
      id: "evt_missing_payment",
      event: "transparent.completed",
      devMode: true,
      data: { status: "PAID", method: "PIX", amount: 1250 },
    })

    expect(() => provider.normalizeEvent(verifiedWebhook(provider, emptyEventId))).toThrow(
      "Envelope",
    )
    expect(provider.normalizeEvent(verifiedWebhook(provider, missingPaymentId))).toMatchObject({
      eventId: "evt_missing_payment",
      status: "UNKNOWN",
      reason: "MISSING_EXTERNAL_ID",
      requiresReconciliation: true,
    })
  })

  it("rejeita event id com espaços", () => {
    const provider = new AbacatePayProvider(config)
    const rawBody = JSON.stringify({
      id: " evt_1 ",
      event: "transparent.completed",
      devMode: true,
      data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1250 },
    })

    expect(() => provider.normalizeEvent(verifiedWebhook(provider, rawBody))).toThrow("Envelope")
  })

  it("rejeita evento confirmado com status remoto incompatível", () => {
    const provider = new AbacatePayProvider(config)
    const rawBody = JSON.stringify({
      id: "evt_inconsistent",
      event: "transparent.completed",
      devMode: true,
      data: { id: "pay_1", status: "FAILED", method: "PIX", amount: 1250 },
    })

    expect(() => provider.normalizeEvent(verifiedWebhook(provider, rawBody))).toThrow(
      "incompatível",
    )
  })

  it("valida token único, expiração e mínimo por parcela antes do HTTP", async () => {
    const http = mock(async () => response({ data: {} }))
    const now = () => new Date("2026-10-20T12:01:01Z")
    const provider = new AbacatePayProvider(config, { http, now })

    await expect(
      provider.createCardPayment({
        amountInCents: 12000,
        customer,
        token: "cardToken",
        tokenIssuedAt: new Date("2026-10-20T12:00:30Z"),
      }),
    ).rejects.toThrow("Token")
    await expect(
      provider.createCardPayment({
        amountInCents: 12000,
        customer,
        token: "ctok_expired",
        tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
      }),
    ).rejects.toThrow("expirado")
    await expect(
      provider.createCardPayment({
        amountInCents: 11000,
        customer,
        token: "ctok_valid",
        tokenIssuedAt: new Date("2026-10-20T12:00:30Z"),
        installments: 12,
      }),
    ).rejects.toThrow("1000")
    await expect(
      provider.createCardPayment({
        amountInCents: 12000,
        customer,
        token: "ctok_invalid_date",
        tokenIssuedAt: new Date("invalid"),
      }),
    ).rejects.toThrow("expirado")
    expect(http).not.toHaveBeenCalled()
  })

  it("valida customer também para PIX", async () => {
    const http = mock(async () => response({ data: {} }))
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.createPixPayment({
        amountInCents: 1250,
        customer: { ...customer, email: "" },
      }),
    ).rejects.toThrow("cliente")
    expect(http).not.toHaveBeenCalled()
  })

  it("rejeita relógio interno inválido antes de enviar o token", async () => {
    const http = mock(async () => response({ data: {} }))
    const provider = new AbacatePayProvider(config, {
      http,
      now: () => new Date("invalid"),
    })

    await expect(
      provider.createCardPayment({
        amountInCents: 12000,
        customer,
        token: "ctok_valid",
        tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
      }),
    ).rejects.toThrow("relógio")
    expect(http).not.toHaveBeenCalled()
  })

  it("exige os dados completos do cliente no cartão", async () => {
    const http = mock(async () => response({ data: {} }))
    const provider = new AbacatePayProvider(config, {
      http,
      now: () => new Date("2026-10-20T12:00:30Z"),
    })

    await expect(
      provider.createCardPayment({
        amountInCents: 12000,
        customer: { ...customer, taxId: "" },
        token: "ctok_valid",
        tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
      }),
    ).rejects.toThrow("cliente")
    expect(http).not.toHaveBeenCalled()
  })

  it("consulta PIX e cartão em endpoints diferentes", async () => {
    const http = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      const id = url.includes("pay_pix") ? "pay_pix" : "pay_card"
      return response({ data: { id, status: "PAID", amount: 1500 } })
    })
    const provider = new AbacatePayProvider(config, { http })

    await provider.getStatus({ externalId: "pay_pix", method: "PIX" })
    await provider.getStatus({ externalId: "pay_card", method: "CARD" })

    const calls = http.mock.calls as unknown as Array<[string, RequestInit | undefined]>
    expect(calls[0]?.[0]).toBe("https://api.abacatepay.com/v2/transparents/check?id=pay_pix")
    expect(calls[1]?.[0]).toBe("https://api.abacatepay.com/v2/transparents/get?id=pay_card")
  })

  it("rejeita data de expiração inválida retornada pelo provider", async () => {
    const http = mock(async () =>
      response({
        data: {
          id: "pay_invalid_date",
          status: "PENDING",
          amount: 1250,
          brCode: "000201",
          brCodeBase64: "base64",
          expiresAt: "invalid-date",
        },
      }),
    )
    const provider = new AbacatePayProvider(config, { http })

    await expect(provider.createPixPayment({ amountInCents: 1250, customer })).rejects.toThrow(
      "expiração",
    )
  })

  it("rejeita data remota calendariamente inválida", async () => {
    const http = mock(async () =>
      response({
        data: {
          id: "pay_invalid_calendar_date",
          status: "PENDING",
          amount: 1250,
          brCode: "000201",
          brCodeBase64: "base64",
          expiresAt: "2026-02-30T12:00:00Z",
        },
      }),
    )
    const provider = new AbacatePayProvider(config, { http })

    await expect(provider.createPixPayment({ amountInCents: 1250, customer })).rejects.toThrow(
      "expiração",
    )
  })

  it("rejeita valor remoto inválido ou divergente na criação", async () => {
    const invalidAmountHttp = mock(async () =>
      response({ data: { id: "pay_zero", status: "PENDING", amount: 0 } }),
    )
    const invalidAmountProvider = new AbacatePayProvider(config, { http: invalidAmountHttp })
    await expect(
      invalidAmountProvider.createPixPayment({ amountInCents: 1250, customer }),
    ).rejects.toThrow("valor")

    const mismatchHttp = mock(async () =>
      response({ data: { id: "pay_mismatch", status: "PENDING", amount: 1300 } }),
    )
    const mismatchProvider = new AbacatePayProvider(config, { http: mismatchHttp })
    await expect(
      mismatchProvider.createPixPayment({ amountInCents: 1250, customer }),
    ).rejects.toThrow("divergente")

    const precisionHttp = mock(async () =>
      response({ data: { id: "pay_precision", status: "PENDING", amount: 1.001 } }),
    )
    const precisionProvider = new AbacatePayProvider(config, { http: precisionHttp })
    await expect(
      precisionProvider.createPixPayment({ amountInCents: 100, customer }),
    ).rejects.toThrow("valor")
  })

  it("classifica criação sem ID remoto como UNKNOWN", async () => {
    const pixHttp = mock(async () =>
      response({
        data: {
          status: "PENDING",
          amount: 1250,
          brCode: "000201",
          brCodeBase64: "base64",
          expiresAt: "2026-10-20T12:00:00Z",
        },
      }),
    )
    const pixProvider = new AbacatePayProvider(config, { http: pixHttp })
    await expect(
      pixProvider.createPixPayment({
        amountInCents: 1250,
        customer,
        externalReference: "attempt_pix",
      }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "MISSING_EXTERNAL_ID",
      reconciliationReference: "attempt_pix",
      requiresReconciliation: true,
    })

    const cardHttp = mock(async () => response({ data: { status: "APPROVED", amount: 12000 } }))
    const cardProvider = new AbacatePayProvider(config, {
      http: cardHttp,
      now: () => new Date("2026-10-20T12:00:30Z"),
    })
    await expect(
      cardProvider.createCardPayment({
        amountInCents: 12000,
        customer,
        token: "ctok_valid",
        tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
        externalReference: "attempt_card",
      }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "MISSING_EXTERNAL_ID",
      reconciliationReference: "attempt_card",
      requiresReconciliation: true,
    })
  })

  it("rejeita resposta 2xx explicitamente malsucedida sem convertê-la em UNKNOWN", async () => {
    const http = mock(async () =>
      response({
        success: false,
        data: { status: "PENDING", amount: 1250 },
      }),
    )
    const provider = new AbacatePayProvider(config, { http })

    await expect(
      provider.createPixPayment({ amountInCents: 1250, customer }),
    ).rejects.toMatchObject({
      code: "REMOTE_REQUEST_FAILED",
    })
  })

  it("classifica resposta 2xx malformada da criação como UNKNOWN", async () => {
    const provider = new AbacatePayProvider(config, {
      http: mock(async () => new Response("not-json", { status: 200 })),
    })

    await expect(
      provider.createPixPayment({
        amountInCents: 1250,
        customer,
        externalReference: "attempt_malformed",
      }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "REMOTE_ERROR",
      reconciliationReference: "attempt_malformed",
      requiresReconciliation: true,
    })
  })

  it("rejeita success false também em consulta e reembolso", async () => {
    const statusProvider = new AbacatePayProvider(config, {
      http: mock(async () => response({ success: false, data: { id: "pay_1", status: "PAID" } })),
    })
    await expect(
      statusProvider.getStatus({ externalId: "pay_1", method: "PIX" }),
    ).rejects.toMatchObject({
      code: "REMOTE_REQUEST_FAILED",
    })

    const refundProvider = new AbacatePayProvider(config, {
      http: mock(async () => response({ success: false, data: { id: "pay_1" } })),
    })
    await expect(refundProvider.refundFull({ externalId: "pay_1" })).rejects.toMatchObject({
      code: "REMOTE_REQUEST_FAILED",
    })
  })

  it("mantém UNKNOWN para 429 e não expõe credenciais no log", async () => {
    const http = mock(async () => response({ code: "RATE_LIMITED" }, 429))
    const error = mock(() => undefined)
    const provider = new AbacatePayProvider(config, {
      http,
      logger: { info: () => undefined, error },
    })

    await expect(
      provider.createPixPayment({ amountInCents: 1250, customer }),
    ).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "REMOTE_ERROR",
      requiresReconciliation: true,
    })
    expect(JSON.stringify(error.mock.calls)).not.toContain("sk_test_provider")
    expect(JSON.stringify(error.mock.calls)).not.toContain("webhook-secret")
  })

  it("rejeita assinatura calculada para outro corpo raw", () => {
    const provider = new AbacatePayProvider(config)
    const signedBody = JSON.stringify({ id: "evt_1", event: "transparent.completed" })
    const alteredBody = JSON.stringify({ id: "evt_2", event: "transparent.completed" })
    const signature = createHmac("sha256", "hmac-secret").update(signedBody).digest("base64")

    expect(() =>
      provider.verifyRequest({
        rawBody: alteredBody,
        signature,
        query: { webhookSecret: "webhook-secret" },
      }),
    ).toThrow("Webhook não autenticado")
  })

  it("rejeita data de ocorrência inválida no webhook", () => {
    const provider = new AbacatePayProvider(config)
    const rawBody = JSON.stringify({
      id: "evt_invalid_date",
      event: "transparent.completed",
      devMode: true,
      data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1250, updatedAt: "invalid-date" },
    })

    expect(() => provider.normalizeEvent(verifiedWebhook(provider, rawBody))).toThrow("data")
  })

  it("não propaga valor remoto fora do intervalo seguro", async () => {
    const http = mock(async () =>
      response({ data: { id: "pay_unsafe", status: "PAID", amount: Number.MAX_SAFE_INTEGER + 1 } }),
    )
    const provider = new AbacatePayProvider(config, { http })

    await expect(provider.getStatus({ externalId: "pay_unsafe", method: "PIX" })).rejects.toThrow(
      "valor",
    )
  })

  it("valida HMAC do corpo raw e normaliza eventos suportados", () => {
    const provider = new AbacatePayProvider(config)
    const rawBody = JSON.stringify({
      id: "evt_1",
      event: "transparent.completed",
      apiVersion: "1",
      devMode: true,
      data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1500 },
    })
    const signature = createHmac("sha256", "hmac-secret").update(rawBody).digest("base64")

    const verified = provider.verifyRequest({
      rawBody,
      signature,
      query: { webhookSecret: "webhook-secret" },
    })
    expect(Object.keys(verified).sort()).toEqual(["environment", "rawBody"])
    expect(verified.environment).toBe("DEV")
    expect(() =>
      provider.verifyRequest({
        rawBody,
        signature: "bad",
        query: { webhookSecret: "webhook-secret" },
      }),
    ).toThrow("Webhook não autenticado")
    expect(() =>
      provider.verifyRequest({ rawBody, signature, query: { webhookSecret: "wrong" } }),
    ).toThrow("Webhook não autenticado")
    expect(() => provider.verifyRequest({ rawBody, signature, query: {} })).toThrow(
      "Webhook não autenticado",
    )
    expect(provider.normalizeEvent(verifiedWebhook(provider, rawBody))).toMatchObject({
      eventId: "evt_1",
      event: "PAYMENT_CONFIRMED",
      method: "PIX",
      status: "CONFIRMED",
    })
  })

  describe("webhook authentication without a public key (card not released)", () => {
    const rawBody = JSON.stringify({
      id: "evt_1",
      event: "transparent.completed",
      apiVersion: "1",
      devMode: false,
      data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1500 },
    })
    const productionProvider = () =>
      new AbacatePayProvider(
        PaymentProviderConfig.create({
          apiKey: "abc_prod_key",
          webhookSecret: "webhook-secret",
          environment: "PRODUCTION",
          devMode: false,
        }),
      )

    it("authenticates by URL secret alone, with or without a signature header", () => {
      const provider = productionProvider()
      expect(
        provider.verifyRequest({ rawBody, signature: null, query: { webhookSecret: "webhook-secret" } })
          .environment,
      ).toBe("PRODUCTION")
      expect(
        provider.verifyRequest({ rawBody, signature: "ignored", query: { webhookSecret: "webhook-secret" } })
          .environment,
      ).toBe("PRODUCTION")
    })

    it("still rejects a wrong or missing URL secret", () => {
      const provider = productionProvider()
      expect(() => provider.verifyRequest({ rawBody, signature: null, query: { webhookSecret: "wrong" } })).toThrow(
        "Webhook não autenticado",
      )
      expect(() => provider.verifyRequest({ rawBody, signature: null, query: {} })).toThrow("Webhook não autenticado")
    })

    it("requires the HMAC again as soon as the public key is configured", () => {
      const provider = new AbacatePayProvider(
        PaymentProviderConfig.create({
          apiKey: "abc_prod_key",
          publicKey: "pk_prod_key",
          webhookSecret: "webhook-secret",
          webhookSigningKey: "pk_prod_key",
          environment: "PRODUCTION",
          devMode: false,
        }),
      )
      expect(() =>
        provider.verifyRequest({ rawBody, signature: null, query: { webhookSecret: "webhook-secret" } }),
      ).toThrow("Webhook não autenticado")
      const signature = createHmac("sha256", "pk_prod_key").update(rawBody).digest("base64")
      expect(
        provider.verifyRequest({ rawBody, signature, query: { webhookSecret: "webhook-secret" } }).environment,
      ).toBe("PRODUCTION")
    })
  })

  it("trata reembolso já realizado como idempotente", async () => {
    const http = mock(async () => response({ code: "ALREADY_REFUNDED" }, 409))
    const provider = new AbacatePayProvider(config, { http })

    await expect(provider.refundFull({ externalId: "pay_refunded" })).resolves.toEqual({
      externalId: "pay_refunded",
      status: "REFUNDED",
    })
  })

  it("rejeita refund sem ID válido antes do HTTP e não fabrica ID remoto", async () => {
    const invalidIdHttp = mock(async () => response({ data: {} }))
    const invalidIdProvider = new AbacatePayProvider(config, { http: invalidIdHttp })
    await expect(invalidIdProvider.refundFull({ externalId: " " })).rejects.toThrow("ID externo")
    expect(invalidIdHttp).not.toHaveBeenCalled()

    const missingRemoteIdHttp = mock(async () => response({ data: {} }))
    const missingRemoteIdProvider = new AbacatePayProvider(config, { http: missingRemoteIdHttp })
    await expect(
      missingRemoteIdProvider.refundFull({ externalId: "pay_refund" }),
    ).rejects.toMatchObject({
      code: "UNKNOWN_RESULT",
    })
  })

  it("classifica falha indeterminada durante refund como UNKNOWN_RESULT", async () => {
    const http = mock(async () => {
      throw Object.assign(new Error("socket timeout"), { name: "TimeoutError" })
    })
    const provider = new AbacatePayProvider(config, { http })

    await expect(provider.refundFull({ externalId: "pay_refund" })).rejects.toMatchObject({
      code: "UNKNOWN_RESULT",
    })
  })

  it("classifica resposta 2xx malformada durante refund como UNKNOWN_RESULT", async () => {
    const provider = new AbacatePayProvider(config, {
      http: mock(async () => new Response("not-json", { status: 200 })),
    })

    await expect(provider.refundFull({ externalId: "pay_refund" })).rejects.toMatchObject({
      code: "UNKNOWN_RESULT",
      retryable: true,
    })
  })

  it("converte valor e customer malformados em erro de validação seguro", async () => {
    const provider = new AbacatePayProvider(config, {
      http: mock(async () => response({ data: {} })),
    })

    await expect(provider.createPixPayment({ amountInCents: 99, customer })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    })
    await expect(
      provider.createPixPayment({ amountInCents: 1250, customer: null as never }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" })
  })

  it("rejeita webhook de ambiente incompatível e ignora evento fora do escopo", () => {
    const provider = new AbacatePayProvider(config)
    const incompatible = JSON.stringify({
      id: "evt_1",
      event: "transparent.completed",
      devMode: false,
      data: {},
    })
    const unknown = JSON.stringify({
      id: "evt_2",
      event: "transparent.created",
      devMode: true,
      data: {},
    })

    expect(() => provider.normalizeEvent(verifiedWebhook(provider, incompatible))).toThrow(
      "incompatível",
    )
    expect(provider.normalizeEvent(verifiedWebhook(provider, unknown))).toBeNull()
  })

  it("rejeita webhook cujo devMode diverge da configuração da instância", () => {
    const provider = new AbacatePayProvider(config)
    const rawBody = JSON.stringify({
      id: "evt_production",
      event: "transparent.completed",
      devMode: false,
      data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1250 },
    })

    expect(() => provider.normalizeEvent(verifiedWebhook(provider, rawBody))).toThrow(
      "Ambiente do webhook",
    )
  })

  it("rejeita VerifiedWebhook forjado em runtime", () => {
    const provider = new AbacatePayProvider(config)
    const forged = {
      rawBody: JSON.stringify({
        id: "evt_forged",
        event: "transparent.completed",
        devMode: true,
        data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1250 },
      }),
      environment: "DEV",
    } as VerifiedWebhook

    expect(() => provider.normalizeEvent(forged)).toThrow("não verificado")
  })
})
