import { describe, expect, it } from "bun:test"
import {
  PaymentMethodUnavailableError,
  assertBillingTypeAllowed,
  resolveCardAvailability,
} from "./availability"

const PRODUCTION_WITHOUT_KEY = { PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION" }
const PRODUCTION_WITH_KEY = {
  PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION",
  ABACATE_PAY_PRODUCTION_PUBLIC_KEY: "pk_live_x",
}

describe("resolveCardAvailability", () => {
  it("bloqueia o cartão em PRODUCTION sem chave pública", () => {
    expect(resolveCardAvailability(PRODUCTION_WITHOUT_KEY)).toEqual({
      card: false,
      reason: "PROVIDER_WITHOUT_CARD",
      availableBillingTypes: ["PIX"],
    })
  })

  it("libera o cartão quando existe chave pública", () => {
    expect(resolveCardAvailability(PRODUCTION_WITH_KEY)).toEqual({
      card: true,
      reason: "AVAILABLE",
      availableBillingTypes: ["PIX", "CREDIT_CARD"],
    })
  })

  it("o flag CARD_PAYMENTS_ENABLED=false bloqueia mesmo com a chave", () => {
    const result = resolveCardAvailability({ ...PRODUCTION_WITH_KEY, CARD_PAYMENTS_ENABLED: "false" })
    expect(result.card).toBe(false)
    expect(result.reason).toBe("DISABLED_BY_FLAG")
    expect(result.availableBillingTypes).toEqual(["PIX"])
  })

  it("assume DEV quando o ambiente não está configurado", () => {
    expect(resolveCardAvailability({}).card).toBe(false)
    expect(resolveCardAvailability({ ABACATE_PAY_DEV_PUBLIC_KEY: "pk_dev" }).card).toBe(true)
  })

  it("ambiente inválido falha fechado (sem cartão)", () => {
    expect(resolveCardAvailability({ PAYMENT_PROVIDER_ENVIRONMENT: "STAGING" }).card).toBe(false)
  })
})

describe("assertBillingTypeAllowed", () => {
  it("sempre aceita PIX e pagamento externo", () => {
    expect(() => assertBillingTypeAllowed("PIX", {}, PRODUCTION_WITHOUT_KEY)).not.toThrow()
    expect(() => assertBillingTypeAllowed("EXTERNAL", {}, PRODUCTION_WITHOUT_KEY)).not.toThrow()
  })

  it("recusa nova escolha de cartão quando indisponível", () => {
    expect(() => assertBillingTypeAllowed("CREDIT_CARD", {}, PRODUCTION_WITHOUT_KEY)).toThrow(
      PaymentMethodUnavailableError,
    )
  })

  it("aceita cartão para quem já tem cartão cadastrado", () => {
    expect(() =>
      assertBillingTypeAllowed("CREDIT_CARD", { existingCardSubscriber: true }, PRODUCTION_WITHOUT_KEY),
    ).not.toThrow()
  })

  it("o flag de kill não abre exceção para assinante: ele só vale para nova escolha", () => {
    expect(() =>
      assertBillingTypeAllowed(
        "CREDIT_CARD",
        { existingCardSubscriber: true },
        { ...PRODUCTION_WITH_KEY, CARD_PAYMENTS_ENABLED: "false" },
      ),
    ).not.toThrow()
  })

  it("aceita cartão quando disponível", () => {
    expect(() => assertBillingTypeAllowed("CREDIT_CARD", {}, PRODUCTION_WITH_KEY)).not.toThrow()
  })

  it("o erro carrega status 422 e mensagem para o pagador", () => {
    try {
      assertBillingTypeAllowed("CREDIT_CARD", {}, PRODUCTION_WITHOUT_KEY)
      throw new Error("deveria lançar")
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentMethodUnavailableError)
      expect((error as PaymentMethodUnavailableError).status).toBe(422)
      expect((error as Error).message).toContain("PIX")
    }
  })
})
