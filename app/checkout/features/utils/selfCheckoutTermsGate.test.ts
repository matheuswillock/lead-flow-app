import { describe, expect, it } from "bun:test"
import {
  isPayBlockedByTerms,
  isTermsAcceptanceRequired,
  MOBILE_TERMS_HINT,
  termsHintFor,
} from "./selfCheckoutTermsGate"

describe("isPayBlockedByTerms", () => {
  it("bloqueia o pagamento enquanto os termos não foram aceitos e o pedido ainda não existe", () => {
    expect(isPayBlockedByTerms({ termsAccepted: false, hasOrder: false })).toBe(true)
  })

  it("libera o pagamento quando os termos foram aceitos", () => {
    expect(isPayBlockedByTerms({ termsAccepted: true, hasOrder: false })).toBe(false)
  })

  it("desmarcar depois de marcar bloqueia de novo", () => {
    expect(isPayBlockedByTerms({ termsAccepted: true, hasOrder: false })).toBe(false)
    expect(isPayBlockedByTerms({ termsAccepted: false, hasOrder: false })).toBe(true)
  })

  it("pedido já criado (retry de pagamento) nunca é bloqueado: o aceite foi enviado na criação", () => {
    expect(isPayBlockedByTerms({ termsAccepted: false, hasOrder: true })).toBe(false)
    expect(isPayBlockedByTerms({ termsAccepted: true, hasOrder: true })).toBe(false)
  })
})

describe("isTermsAcceptanceRequired", () => {
  it("só pede o aceite antes de existir pedido", () => {
    expect(isTermsAcceptanceRequired({ hasOrder: false })).toBe(true)
    expect(isTermsAcceptanceRequired({ hasOrder: true })).toBe(false)
  })
})

describe("textos do motivo do bloqueio", () => {
  it("nomeiam a ação bloqueada de cada forma de pagamento", () => {
    expect(termsHintFor(false)).toContain("QR Code PIX")
    expect(termsHintFor(true)).toContain("cartão")
  })

  it("a legenda do celular é curta", () => {
    expect(MOBILE_TERMS_HINT.length).toBeLessThanOrEqual(32)
  })
})
