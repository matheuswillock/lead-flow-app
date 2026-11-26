import { describe, expect, it } from "bun:test"
import {
  PAYMENT_PHASE,
  PLAN_PHASE,
  canOpenPaymentPhase,
  effectiveInstallments,
  paymentCaption,
  paymentSubmitLabel,
  resolveActivePhase,
  resolvePaymentMethod,
} from "./billingGracePhases"

describe("fase de pagamento", () => {
  it("só abre depois de escolher um prazo", () => {
    expect(canOpenPaymentPhase(false)).toBe(false)
    expect(canOpenPaymentPhase(true)).toBe(true)
  })

  it("com pagamento criado, a tela fica na fase de pagamento", () => {
    expect(resolveActivePhase(true, PLAN_PHASE)).toBe(PAYMENT_PHASE)
    expect(resolveActivePhase(false, PLAN_PHASE)).toBe(PLAN_PHASE)
    expect(resolveActivePhase(false, 9)).toBe(PAYMENT_PHASE)
    expect(resolveActivePhase(false, -3)).toBe(PLAN_PHASE)
  })
})

describe("forma de pagamento", () => {
  it("cartão só vale quando a renovação traz o checkout do cartão", () => {
    expect(resolvePaymentMethod("CREDIT_CARD", true)).toBe("CREDIT_CARD")
    expect(resolvePaymentMethod("CREDIT_CARD", false)).toBe("PIX")
    expect(resolvePaymentMethod("PIX", true)).toBe("PIX")
  })

  it("parcelas nunca passam do máximo do prazo", () => {
    expect(effectiveInstallments(12, 3)).toBe(3)
    expect(effectiveInstallments(2, 12)).toBe(2)
    expect(effectiveInstallments(0, 1)).toBe(1)
  })

  it("rótulo do envio segue o método e o estado", () => {
    expect(paymentSubmitLabel({ method: "PIX", isBusy: false, isTokenizing: false })).toBe("Gerar QR Code PIX")
    expect(paymentSubmitLabel({ method: "PIX", isBusy: true, isTokenizing: false })).toBe("Gerando o QR Code...")
    expect(paymentSubmitLabel({ method: "CREDIT_CARD", isBusy: false, isTokenizing: false })).toBe("Pagar com cartão")
    expect(paymentSubmitLabel({ method: "CREDIT_CARD", isBusy: true, isTokenizing: false })).toBe("Processando...")
    expect(paymentSubmitLabel({ method: "CREDIT_CARD", isBusy: true, isTokenizing: true })).toBe("Validando o cartão...")
  })

  it("legenda do total muda com o método e as parcelas", () => {
    expect(paymentCaption("PIX", 1)).toBe("à vista no PIX")
    expect(paymentCaption("CREDIT_CARD", 1)).toBe("no cartão")
    expect(paymentCaption("CREDIT_CARD", 4)).toBe("em 4x no cartão")
  })
})
