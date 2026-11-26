import { describe, expect, test } from "bun:test"
import type { AccountAccessRestrictionReason } from "@/app/api/shared/accountAccessDecision/types"
import {
  getAccessPausedAction,
  getPaymentRecoveryHref,
  isPaymentRecoveryPath,
} from "./accountAccessRecovery"

describe("getAccessPausedAction", () => {
  test("master com pagamento pendente, suspensão ou cancelamento vai para o pagamento", () => {
    for (const reason of ["past_due", "suspended", "canceled"] as const) {
      expect(getAccessPausedAction(reason, true)).toBe("payment")
    }
  })

  test("quem não é master vê só o aviso, sem ação", () => {
    for (const reason of ["past_due", "suspended", "canceled", "subscription_unavailable"] as const) {
      expect(getAccessPausedAction(reason, false)).toBe("none")
    }
    expect(getAccessPausedAction(undefined, false)).toBe("none")
  })

  test("banido fala com o time de assinaturas, inclusive o master", () => {
    expect(getAccessPausedAction("banned", true)).toBe("support")
    expect(getAccessPausedAction("banned", false)).toBe("support")
  })

  test("master com assinatura indisponível ou sem motivo fala com o suporte, sem pagar", () => {
    expect(getAccessPausedAction("subscription_unavailable", true)).toBe("support")
    expect(getAccessPausedAction(undefined, true)).toBe("support")
  })

  test("nunca oferece pagamento para banido", () => {
    const reasons: AccountAccessRestrictionReason[] = ["banned"]
    for (const reason of reasons) {
      expect(getAccessPausedAction(reason, true)).not.toBe("payment")
    }
  })
})

describe("isPaymentRecoveryPath", () => {
  test("libera só a página de pagamento da própria conta", () => {
    expect(isPaymentRecoveryPath("/pagamento/abc-123")).toBe(true)
    expect(isPaymentRecoveryPath("/pagamento/abc-123/")).toBe(true)
  })

  test("não libera outras rotas, subrotas nem rotas parecidas", () => {
    expect(isPaymentRecoveryPath("/abc-123/dashboard")).toBe(false)
    expect(isPaymentRecoveryPath("/abc-123/subscription")).toBe(false)
    expect(isPaymentRecoveryPath("/abc-123/billing-grace-payment")).toBe(false)
    expect(isPaymentRecoveryPath("/pagamento/abc-123/extra")).toBe(false)
    expect(isPaymentRecoveryPath("/pagamento-old/abc-123")).toBe(false)
    expect(isPaymentRecoveryPath("/pagamento")).toBe(false)
    expect(isPaymentRecoveryPath("//pagamento/abc-123")).toBe(false)
    expect(isPaymentRecoveryPath("")).toBe(false)
    expect(isPaymentRecoveryPath(null)).toBe(false)
    expect(isPaymentRecoveryPath(undefined)).toBe(false)
  })
})

describe("getPaymentRecoveryHref", () => {
  test("monta o link da página de pagamento da conta", () => {
    expect(getPaymentRecoveryHref("abc-123")).toBe("/pagamento/abc-123")
  })
})
