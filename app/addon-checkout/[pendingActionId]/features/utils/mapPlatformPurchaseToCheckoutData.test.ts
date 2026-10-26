import { describe, expect, it } from "bun:test"
import { mapPlatformPurchaseToCheckoutData } from "./mapPlatformPurchaseToCheckoutData"

describe("mapPlatformPurchaseToCheckoutData", () => {
  it("mapeia compra de créditos de e-mail para o contrato do checkout público", () => {
    const data = mapPlatformPurchaseToCheckoutData({
      checkoutId: "p1",
      purchaseId: "p1",
      productSlug: "email-credits-plus",
      purchaseType: "email_credits",
      status: "pending",
      billingType: "PIX",
      amount: 100,
      quantity: 5000,
      description: "Créditos de e-mail — plano plus",
      teamId: "team-1",
      metadata: { plan: "plus", teamName: "Comercial" },
    })

    expect(data.checkoutSource).toBe("platform_purchase")
    expect(data.addonLabel).toBe("Plus")
    expect(data.addonDetail).toContain("5.000")
    expect(data.addonDetail).toContain("Comercial")
    expect(data.pricing.totalCharge).toBe(100)
    expect(data.activationHint).toBe(
      "Após a confirmação do pagamento, os créditos são aplicados automaticamente em até 5 minutos."
    )
    expect(data.alreadyPaid).toBe(false)
  })

  it("falha fechada para PIX quando a API não declara availableBillingTypes", () => {
    const data = mapPlatformPurchaseToCheckoutData({
      checkoutId: "p3",
      purchaseId: "p3",
      productSlug: "email-credits-plus",
      purchaseType: "email_credits",
      status: "pending",
      billingType: "CREDIT_CARD",
      amount: 100,
      quantity: 1,
      description: null,
      teamId: null,
    })

    expect(data.availableBillingTypes).toEqual(["PIX"])
  })

  it("não exibe valor vazio quando a compra não tem time", () => {
    const base = {
      checkoutId: "p2",
      purchaseId: "p2",
      productSlug: "email-credits-plus",
      purchaseType: "email_credits",
      status: "pending",
      billingType: "PIX",
      amount: 100,
      description: null,
      teamId: null,
      metadata: {},
    }

    const withCredits = mapPlatformPurchaseToCheckoutData({ ...base, quantity: 5000 })
    expect(withCredits.addonDetail).toBe("5.000 créditos/mês")

    const withoutAnything = mapPlatformPurchaseToCheckoutData({ ...base, quantity: null })
    expect(withoutAnything.addonDetail).toBe("")
    expect(withoutAnything.addonDetail).not.toContain("—")
  })
})
