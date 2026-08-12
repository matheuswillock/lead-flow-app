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
      "A ativação acontece após confirmação do pagamento."
    )
    expect(data.alreadyPaid).toBe(false)
  })
})
