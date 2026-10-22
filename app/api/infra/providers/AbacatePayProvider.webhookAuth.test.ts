import { createHmac } from "node:crypto"
import { describe, expect, it, mock } from "bun:test"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import { AbacatePayProvider } from "./AbacatePayProvider"

const rawBody = JSON.stringify({
  id: "evt_1",
  event: "transparent.completed",
  devMode: false,
  data: { id: "pay_1", status: "PAID", method: "PIX", amount: 1500 },
})
const sign = (key: string, body = rawBody) => createHmac("sha256", key).update(body).digest("base64")

function productionConfig(extra: Record<string, unknown> = {}) {
  return PaymentProviderConfig.create({
    apiKey: "abc_prod_key",
    webhookSecret: "current-secret",
    environment: "PRODUCTION",
    devMode: false,
    ...extra,
  })
}

function build(extra: Record<string, unknown> = {}) {
  const alert = mock(async (_input: unknown) => undefined)
  const provider = new AbacatePayProvider(productionConfig(extra), { alerter: { alert } })
  return { provider, alert }
}

const query = (webhookSecret: string | null) => ({ webhookSecret })

describe("AbacatePayProvider.verifyRequest — HMAC obrigatório (PAY-HARD-T012)", () => {
  it("com chave de assinatura: sem X-Webhook-Signature responde WEBHOOK_INVALID mesmo com o segredo da query correto", () => {
    const { provider } = build({ publicKey: "pk", webhookSigningKey: "pk" })
    expect(() => provider.verifyRequest({ rawBody, signature: null, query: query("current-secret") })).toThrow(
      "Webhook não autenticado",
    )
  })

  it("com chave de assinatura: assinatura inválida é rejeitada mesmo com o segredo correto", () => {
    const { provider } = build({ publicKey: "pk", webhookSigningKey: "pk" })
    expect(() =>
      provider.verifyRequest({ rawBody, signature: sign("outra-chave"), query: query("current-secret") }),
    ).toThrow("Webhook não autenticado")
    expect(() =>
      provider.verifyRequest({ rawBody, signature: "curta", query: query("current-secret") }),
    ).toThrow("Webhook não autenticado")
  })

  it("com chave de assinatura: assinatura válida passa e não emite alerta", () => {
    const { provider, alert } = build({ publicKey: "pk", webhookSigningKey: "pk" })
    expect(provider.verifyRequest({ rawBody, signature: sign("pk"), query: query("current-secret") }).environment).toBe(
      "PRODUCTION",
    )
    expect(alert).not.toHaveBeenCalled()
  })

  it("assinatura válida com segredo da query errado continua rejeitada", () => {
    const { provider } = build({ publicKey: "pk", webhookSigningKey: "pk" })
    expect(() =>
      provider.verifyRequest({ rawBody, signature: sign("pk"), query: query("wrong") }),
    ).toThrow("Webhook não autenticado")
  })

  it("requireSignature sem chave configurada falha fechada e alerta", () => {
    const { provider, alert } = build({ requireSignature: true })
    expect(() =>
      provider.verifyRequest({ rawBody, signature: sign("qualquer"), query: query("current-secret") }),
    ).toThrow("Webhook não autenticado")
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0]?.[0]).toMatchObject({ key: "payment-webhook-signature-key-missing", level: "error" })
  })

  it("requireSignature com chave exige HMAC válido", () => {
    const { provider } = build({ publicKey: "pk", webhookSigningKey: "pk", requireSignature: true })
    expect(() => provider.verifyRequest({ rawBody, signature: null, query: query("current-secret") })).toThrow(
      "Webhook não autenticado",
    )
  })

  it("produção sem chave e sem requireSignature aceita só pelo segredo, mas alerta (warning, deduplicado)", () => {
    const { provider, alert } = build()
    provider.verifyRequest({ rawBody, signature: null, query: query("current-secret") })
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0]?.[0]).toMatchObject({
      key: "payment-webhook-without-hmac",
      level: "warning",
      dedupeWindowMs: expect.any(Number),
    })
  })

  it("não alerta sobre HMAC ausente quando o segredo da query é inválido (só rejeita)", () => {
    const { provider, alert } = build()
    expect(() => provider.verifyRequest({ rawBody, signature: null, query: query("wrong") })).toThrow()
    expect(alert).not.toHaveBeenCalled()
  })
})

describe("AbacatePayProvider.verifyRequest — rotação do segredo da query (janela atual + anterior)", () => {
  it("aceita o segredo anterior e o atual; rejeita qualquer outro", () => {
    const { provider } = build({ webhookSecretPrevious: "old-secret" })
    expect(provider.verifyRequest({ rawBody, signature: null, query: query("old-secret") }).environment).toBe("PRODUCTION")
    expect(provider.verifyRequest({ rawBody, signature: null, query: query("current-secret") }).environment).toBe(
      "PRODUCTION",
    )
    expect(() => provider.verifyRequest({ rawBody, signature: null, query: query("older") })).toThrow()
    expect(() => provider.verifyRequest({ rawBody, signature: null, query: query(null) })).toThrow()
  })

  it("sem segredo anterior configurado, o antigo não vale", () => {
    const { provider } = build()
    expect(() => provider.verifyRequest({ rawBody, signature: null, query: query("old-secret") })).toThrow()
  })

  it("o segredo anterior também passa pela exigência de HMAC", () => {
    const { provider } = build({ publicKey: "pk", webhookSigningKey: "pk", webhookSecretPrevious: "old-secret" })
    expect(() => provider.verifyRequest({ rawBody, signature: null, query: query("old-secret") })).toThrow()
    expect(provider.verifyRequest({ rawBody, signature: sign("pk"), query: query("old-secret") }).environment).toBe(
      "PRODUCTION",
    )
  })
})
