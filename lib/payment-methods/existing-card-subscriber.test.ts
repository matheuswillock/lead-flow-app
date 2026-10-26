import { describe, expect, it, mock } from "bun:test"
import { PaymentMethodUnavailableError } from "./availability"
import {
  assertCardChoiceAllowedForAccount,
  isExistingCardSubscriber,
  resolveBillingTypesForAccount,
} from "./existing-card-subscriber"

const CARD_OFF = { PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION" }
const CARD_ON = { PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION", ABACATE_PAY_PRODUCTION_PUBLIC_KEY: "pk" }
const withCard = async () => ({ billingType: "CREDIT_CARD", creditCardToken: "tok" })

describe("isExistingCardSubscriber", () => {
  it("assinatura real em cartão com token -> true", async () => {
    expect(await isExistingCardSubscriber({ asaasSubscriptionId: "sub_1" }, withCard)).toBe(true)
  })
  it("assinatura em PIX -> false", async () => {
    const fetch = async () => ({ billingType: "PIX", creditCardToken: null })
    expect(await isExistingCardSubscriber({ asaasSubscriptionId: "sub_1" }, fetch)).toBe(false)
  })
  it("cartão sem token -> false", async () => {
    const fetch = async () => ({ billingType: "CREDIT_CARD" })
    expect(await isExistingCardSubscriber({ asaasSubscriptionId: "sub_1" }, fetch)).toBe(false)
  })
  it("sem assinatura ou placeholder de adesão não consulta o provider", async () => {
    const fetch = mock(withCard)
    expect(await isExistingCardSubscriber({ asaasSubscriptionId: null }, fetch)).toBe(false)
    expect(await isExistingCardSubscriber({ asaasSubscriptionId: "adhesion-1" }, fetch)).toBe(false)
    expect(await isExistingCardSubscriber({ asaasSubscriptionId: "external-adhesion-1" }, fetch)).toBe(false)
    expect(await isExistingCardSubscriber(null, fetch)).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("falha do provider falha fechada", async () => {
    const fetch = async () => {
      throw new Error("boom")
    }
    expect(await isExistingCardSubscriber({ asaasSubscriptionId: "sub_1" }, fetch)).toBe(false)
  })
})

describe("assertCardChoiceAllowedForAccount", () => {
  it("PIX sempre passa sem consultar o provider", async () => {
    const fetch = mock(withCard)
    await assertCardChoiceAllowedForAccount("PIX", null, fetch, CARD_OFF)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("cartão ligado passa sem consultar o provider", async () => {
    const fetch = mock(withCard)
    await assertCardChoiceAllowedForAccount("CREDIT_CARD", null, fetch, CARD_ON)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("cartão desligado barra quem não tem cartão", async () => {
    const fetch = async () => ({ billingType: "PIX" })
    await expect(
      assertCardChoiceAllowedForAccount("CREDIT_CARD", { asaasSubscriptionId: "sub_1" }, fetch, CARD_OFF),
    ).rejects.toBeInstanceOf(PaymentMethodUnavailableError)
  })
  it("cartão desligado passa para assinante com cartão", async () => {
    await assertCardChoiceAllowedForAccount("CREDIT_CARD", { asaasSubscriptionId: "sub_1" }, withCard, CARD_OFF)
  })
  it("flag CARD_PAYMENTS_ENABLED=false barra quem não tem cartão mesmo com chave", async () => {
    await expect(
      assertCardChoiceAllowedForAccount("CREDIT_CARD", null, withCard, { ...CARD_ON, CARD_PAYMENTS_ENABLED: "false" }),
    ).rejects.toBeInstanceOf(PaymentMethodUnavailableError)
  })
})

describe("resolveBillingTypesForAccount", () => {
  it("cartão ligado devolve a lista global", async () => {
    expect(await resolveBillingTypesForAccount(null, withCard, ["PIX", "CREDIT_CARD"])).toEqual(["PIX", "CREDIT_CARD"])
  })
  it("cartão desligado: assinante com cartão ganha CREDIT_CARD", async () => {
    expect(await resolveBillingTypesForAccount({ asaasSubscriptionId: "s" }, withCard, ["PIX"])).toEqual(["PIX", "CREDIT_CARD"])
  })
  it("cartão desligado: demais ficam só PIX", async () => {
    expect(await resolveBillingTypesForAccount(null, withCard, ["PIX"])).toEqual(["PIX"])
  })
})
