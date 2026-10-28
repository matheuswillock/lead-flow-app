import { describe, expect, it } from "bun:test"
import {
  PaymentMethodUnavailableError,
  assertBillingTypeAllowed,
  computeCardAvailability,
  resolveCardAvailability,
  type CardEnabledReader,
} from "./availability"

const PRODUCTION_WITHOUT_KEY = { PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION" }
const PRODUCTION_WITH_KEY = {
  PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION",
  ABACATE_PAY_PRODUCTION_PUBLIC_KEY: "pk_live_x",
}

const cardOn: CardEnabledReader = async () => true
const cardOff: CardEnabledReader = async () => false

describe("computeCardAvailability", () => {
  it("fica desligado quando o backoffice não ligou o cartão, mesmo com a chave pública", () => {
    expect(computeCardAvailability({ cardEnabled: false, env: PRODUCTION_WITH_KEY })).toEqual({
      card: false,
      reason: "DISABLED_BY_BACKOFFICE",
      availableBillingTypes: ["PIX"],
    })
  })

  it("bloqueia o cartão ligado no backoffice quando falta a chave pública", () => {
    expect(computeCardAvailability({ cardEnabled: true, env: PRODUCTION_WITHOUT_KEY })).toEqual({
      card: false,
      reason: "PROVIDER_WITHOUT_CARD",
      availableBillingTypes: ["PIX"],
    })
  })

  it("libera o cartão só com flag ligada e chave pública", () => {
    expect(computeCardAvailability({ cardEnabled: true, env: PRODUCTION_WITH_KEY })).toEqual({
      card: true,
      reason: "AVAILABLE",
      availableBillingTypes: ["PIX", "CREDIT_CARD"],
    })
  })

  it("CARD_PAYMENTS_ENABLED=false vence a flag do backoffice e a chave", () => {
    const result = computeCardAvailability({
      cardEnabled: true,
      env: { ...PRODUCTION_WITH_KEY, CARD_PAYMENTS_ENABLED: "false" },
    })
    expect(result.card).toBe(false)
    expect(result.reason).toBe("DISABLED_BY_FLAG")
  })
})

describe("resolveCardAvailability", () => {
  it("libera o cartão quando a flag lida está ligada e há chave pública", async () => {
    expect((await resolveCardAvailability(PRODUCTION_WITH_KEY, cardOn)).card).toBe(true)
  })

  it("não abre o cartão só porque a chave pública foi cadastrada", async () => {
    const result = await resolveCardAvailability(PRODUCTION_WITH_KEY, cardOff)
    expect(result.card).toBe(false)
    expect(result.availableBillingTypes).toEqual(["PIX"])
  })

  it("passa o ambiente resolvido ao leitor da flag", async () => {
    const seen: string[] = []
    await resolveCardAvailability(PRODUCTION_WITH_KEY, async (environment) => {
      seen.push(environment)
      return true
    })
    expect(seen).toEqual(["PRODUCTION"])
  })

  it("assume DEV quando o ambiente não está configurado", async () => {
    expect((await resolveCardAvailability({}, cardOn)).card).toBe(false)
    expect((await resolveCardAvailability({ ABACATE_PAY_DEV_PUBLIC_KEY: "pk_dev" }, cardOn)).card).toBe(
      true,
    )
  })

  it("ambiente inválido falha fechado sem consultar a flag", async () => {
    let called = false
    const result = await resolveCardAvailability({ PAYMENT_PROVIDER_ENVIRONMENT: "STAGING" }, async () => {
      called = true
      return true
    })
    expect(result.card).toBe(false)
    expect(called).toBe(false)
  })
})

describe("assertBillingTypeAllowed", () => {
  it("sempre aceita PIX e pagamento externo", async () => {
    await expect(assertBillingTypeAllowed("PIX", {}, PRODUCTION_WITHOUT_KEY, cardOff)).resolves.toBeUndefined()
    await expect(
      assertBillingTypeAllowed("EXTERNAL", {}, PRODUCTION_WITHOUT_KEY, cardOff),
    ).resolves.toBeUndefined()
  })

  it("recusa nova escolha de cartão quando indisponível", async () => {
    await expect(
      assertBillingTypeAllowed("CREDIT_CARD", {}, PRODUCTION_WITH_KEY, cardOff),
    ).rejects.toBeInstanceOf(PaymentMethodUnavailableError)
  })

  it("aceita cartão para quem já tem cartão cadastrado", async () => {
    await expect(
      assertBillingTypeAllowed("CREDIT_CARD", { existingCardSubscriber: true }, PRODUCTION_WITHOUT_KEY, cardOff),
    ).resolves.toBeUndefined()
  })

  it("o kill por ambiente não abre exceção para assinante: ele só vale para nova escolha", async () => {
    await expect(
      assertBillingTypeAllowed(
        "CREDIT_CARD",
        { existingCardSubscriber: true },
        { ...PRODUCTION_WITH_KEY, CARD_PAYMENTS_ENABLED: "false" },
        cardOn,
      ),
    ).resolves.toBeUndefined()
  })

  it("aceita cartão quando disponível", async () => {
    await expect(
      assertBillingTypeAllowed("CREDIT_CARD", {}, PRODUCTION_WITH_KEY, cardOn),
    ).resolves.toBeUndefined()
  })

  it("o erro carrega status 422 e mensagem para o pagador", async () => {
    const error = await assertBillingTypeAllowed("CREDIT_CARD", {}, PRODUCTION_WITHOUT_KEY, cardOff).catch(
      (caught) => caught,
    )
    expect(error).toBeInstanceOf(PaymentMethodUnavailableError)
    expect((error as PaymentMethodUnavailableError).status).toBe(422)
    expect((error as Error).message).toContain("PIX")
  })
})
