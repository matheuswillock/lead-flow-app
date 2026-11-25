import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { canOfferPaymentFromBlockedFeature } from "./accountAccessRecovery"
import { FeatureBlockedPanel } from "./FeatureBlockedPanel"

const GRACE_DECISION = { state: "allowed", billingGraceUntil: "2026-12-10T00:00:00.000Z" } as const
const READ_ONLY_DECISION = { state: "read_only", reason: "past_due" } as const

describe("canOfferPaymentFromBlockedFeature", () => {
  test("master em carência de cobrança ou em somente leitura pode regularizar", () => {
    expect(canOfferPaymentFromBlockedFeature(GRACE_DECISION, true)).toBe(true)
    expect(canOfferPaymentFromBlockedFeature(READ_ONLY_DECISION, true)).toBe(true)
  })

  test("quem não é master nunca recebe o botão de pagamento", () => {
    expect(canOfferPaymentFromBlockedFeature(GRACE_DECISION, false)).toBe(false)
    expect(canOfferPaymentFromBlockedFeature(READ_ONLY_DECISION, false)).toBe(false)
  })

  test("sem cobrança pendente a falta de módulo não vira convite a pagar", () => {
    expect(canOfferPaymentFromBlockedFeature({ state: "allowed" }, true)).toBe(false)
    expect(canOfferPaymentFromBlockedFeature({ state: "allowed", temporaryAccessGranted: true }, true)).toBe(false)
    expect(canOfferPaymentFromBlockedFeature(null, true)).toBe(false)
    expect(canOfferPaymentFromBlockedFeature(undefined, true)).toBe(false)
  })
})

describe("FeatureBlockedPanel", () => {
  test("para o master com cobrança pendente, leva à regularização com o texto aprovado", () => {
    const markup = renderToStaticMarkup(createElement(FeatureBlockedPanel, {
      supabaseId: "conta-1",
      offerPayment: true,
    }))

    expect(markup).toContain("Acesso não liberado")
    expect(markup).toContain("Esta funcionalidade não está liberada para o seu usuário no momento.")
    expect(markup).toContain('href="/conta-1/billing-grace-payment"')
    expect(markup).toContain("Regularizar assinatura")
  })

  test("sem a oferta de pagamento mantém só o texto, sem link de regularização", () => {
    const markup = renderToStaticMarkup(createElement(FeatureBlockedPanel, {
      supabaseId: "conta-1",
      offerPayment: false,
    }))

    expect(markup).toContain("Acesso não liberado")
    expect(markup).not.toContain("billing-grace-payment")
    expect(markup).not.toContain("Regularizar assinatura")
  })
})
