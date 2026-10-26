import { describe, expect, it, mock } from "bun:test"
import { BillingPriceResolver } from "./BillingPriceResolver"

function buildRepository() {
  return {
    findByIdWithPaymentRules: mock(async () => null),
    findByFeatureSlugWithPaymentRules: mock(async () => [{
      id: "crm-default",
      isActive: true,
      isDefault: true,
      paymentRules: [
        { price: 89.9, billingCycle: "monthly", paymentMethod: "PIX" },
        { price: 102.9, billingCycle: "monthly", paymentMethod: "CREDIT_CARD" },
      ],
    }]),
  } as any
}

describe("BillingPriceResolver", () => {
  it("usa o produto CRM padrão e a regra exata do método", async () => {
    const repository = buildRepository()
    const resolver = new BillingPriceResolver(repository)

    await expect(resolver.resolvePrice({
      featureSlug: "crm",
      cycle: "monthly",
      method: "PIX",
    })).resolves.toBe(89.9)
    expect(repository.findByFeatureSlugWithPaymentRules).toHaveBeenCalledWith("crm")
  })

  it("não usa preço de outro método como fallback", async () => {
    const repository = buildRepository()
    repository.findByFeatureSlugWithPaymentRules.mockResolvedValue([{
      id: "crm-default",
      isActive: true,
      isDefault: true,
      paymentRules: [{ price: 89.9, billingCycle: "monthly", paymentMethod: "PIX" }],
    }])
    const resolver = new BillingPriceResolver(repository)

    await expect(resolver.resolvePrice({
      featureSlug: "crm",
      cycle: "monthly",
      method: "CREDIT_CARD",
    })).resolves.toBeNull()
  })

  it("bloqueia quando há mais de um produto padrão para o recurso", async () => {
    const repository = buildRepository()
    repository.findByFeatureSlugWithPaymentRules.mockResolvedValue([
      { id: "crm-a", isActive: true, isDefault: true, paymentRules: [] },
      { id: "crm-b", isActive: true, isDefault: true, paymentRules: [] },
    ])
    const resolver = new BillingPriceResolver(repository)

    await expect(resolver.resolvePrice({
      featureSlug: "crm",
      cycle: "monthly",
      method: "PIX",
    })).resolves.toBeNull()
  })
})
