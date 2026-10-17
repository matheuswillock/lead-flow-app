import { describe, expect, it } from "bun:test"
import type {
  CatalogCapability,
  CreateCardPaymentInput,
  CreatePixPaymentInput,
  CustomerCapability,
  FullRefundCapability,
  OneTimePaymentCapability,
  PaymentQueryCapability,
  RawWebhookRequest,
  VerifiedWebhook,
  WebhookCapability,
} from "./contracts"

type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false

const oneTimeHasPix: HasKey<OneTimePaymentCapability, "createPixPayment"> = true
const oneTimeHasCard: HasKey<OneTimePaymentCapability, "createCardPayment"> = true
const oneTimeHasUnified: HasKey<OneTimePaymentCapability, "createPayment"> = false
const webhookHasVerify: HasKey<WebhookCapability, "verifyRequest"> = true
const webhookHasNormalize: HasKey<WebhookCapability, "normalizeEvent"> = true
const webhookHasLegacyVerify: HasKey<WebhookCapability, "verifyWebhook"> = false
const webhookHasLegacyNormalize: HasKey<WebhookCapability, "normalizeWebhook"> = false

describe("segregated payment provider capabilities", () => {
  it("exposes one-time payment as explicit per-method operations", () => {
    expect([oneTimeHasPix, oneTimeHasCard, oneTimeHasUnified]).toEqual([true, true, false])
  })

  it("separates webhook transport verification from event normalization", () => {
    expect([
      webhookHasVerify,
      webhookHasNormalize,
      webhookHasLegacyVerify,
      webhookHasLegacyNormalize,
    ]).toEqual([true, true, false, false])
  })

  it("passes a sanitized verified webhook to normalization", () => {
    const request = {
      rawBody: "{}",
      signature: null,
      query: { secret: null },
    } satisfies RawWebhookRequest

    // @ts-expect-error a bare object is not a verified webhook; only verifyRequest mints one
    const forged: VerifiedWebhook = { rawBody: request.rawBody, environment: "DEV" }

    expect(forged.rawBody).toBe("{}")
    expect(Object.keys(forged).sort()).toEqual(["environment", "rawBody"])
  })

  it("segregates customer, catalog, query, refund and creation into separate contracts", () => {
    const customer: HasKey<CustomerCapability, "createCustomer"> = true
    const catalog: HasKey<CatalogCapability, "syncProduct"> = true
    const query: HasKey<PaymentQueryCapability, "getStatus"> = true
    const refund: HasKey<FullRefundCapability, "refundFull"> = true

    expect([customer, catalog, query, refund]).toEqual([true, true, true, true])
  })

  it("requires the card token fields for card creation and not for PIX", () => {
    const card: CreateCardPaymentInput = {
      amountInCents: 1000,
      customer: { name: "a", email: "a@b.com", taxId: "1", cellphone: "1" },
      token: "tok",
      tokenIssuedAt: new Date("2026-10-20T12:00:00Z"),
    }
    const pix: CreatePixPaymentInput = {
      amountInCents: 1000,
      customer: { name: "a", email: "a@b.com", taxId: "1", cellphone: "1" },
    }

    expect(card.token).toBe("tok")
    expect(pix.amountInCents).toBe(1000)
  })
})
