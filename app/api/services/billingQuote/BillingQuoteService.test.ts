import { describe, expect, it } from "bun:test"
import { BillingQuoteService } from "./BillingQuoteService"

describe("BillingQuoteService", () => {
  it("cobra cada membro ativo distinto uma vez e somente os times adicionais", () => {
    const quote = new BillingQuoteService().createQuote({
      billingOwnerId: "owner-1",
      billingCycle: "monthly",
      baseProduct: { productId: "base", slug: "crm", name: "CRM", unitAmount: 59.9 },
      extraUserProduct: { productId: "extra-user", slug: "extra-user", name: "Usuário adicional", unitAmount: 19.9 },
      extraTeamProduct: { productId: "extra-team", slug: "extra-team", name: "Time adicional", unitAmount: 29.9 },
      billableActiveMembers: 3,
      activeTeams: 2,
      includedExtraUsers: 0,
      includedExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      currentAsaasAmount: 129.6,
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
    })

    expect(quote.products).toEqual([
      { productId: "base", slug: "crm", name: "CRM", quantity: 1, unitAmount: 59.9, totalAmount: 59.9 },
      { productId: "extra-user", slug: "extra-user", name: "Usuário adicional", quantity: 2, unitAmount: 19.9, totalAmount: 39.8 },
      { productId: "extra-team", slug: "extra-team", name: "Time adicional", quantity: 1, unitAmount: 29.9, totalAmount: 29.9 },
    ])
    expect(quote.recurringAmount).toBe(129.6)
    expect(quote.status).toBe("aligned")
  })

  it("cobra a capacidade adicional contratada mesmo sem uso", () => {
    const quote = new BillingQuoteService().createQuote({
      billingOwnerId: "owner-1",
      billingCycle: "monthly",
      baseProduct: { productId: "base", slug: "crm", name: "CRM", unitAmount: 59.9 },
      extraUserProduct: { productId: "extra-user", slug: "extra-user", name: "Usuário adicional", unitAmount: 19.9 },
      extraTeamProduct: { productId: "extra-team", slug: "extra-team", name: "Time adicional", unitAmount: 29.9 },
      billableActiveMembers: 1,
      activeTeams: 1,
      includedExtraUsers: 2,
      includedExtraTeams: 1,
      manualAdjustmentExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      currentAsaasAmount: 129.6,
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
    })

    expect(quote.products.find((product) => product.slug === "extra-user")?.quantity).toBe(2)
    expect(quote.products.find((product) => product.slug === "extra-team")?.quantity).toBe(1)
    expect(quote.adjustments).toEqual([])
    expect(quote.recurringAmount).toBe(129.6)
  })

  it("cobra a capacidade contratada quando o uso é parcial", () => {
    const quote = new BillingQuoteService().createQuote({
      billingOwnerId: "owner-1",
      billingCycle: "monthly",
      baseProduct: { productId: "base", slug: "crm", name: "CRM", unitAmount: 59.9 },
      extraUserProduct: { productId: "extra-user", slug: "extra-user", name: "Usuário adicional", unitAmount: 19.9 },
      extraTeamProduct: { productId: "extra-team", slug: "extra-team", name: "Time adicional", unitAmount: 29.9 },
      billableActiveMembers: 2,
      activeTeams: 1,
      includedExtraUsers: 2,
      includedExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      currentAsaasAmount: 99.7,
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
    })

    expect(quote.products.find((product) => product.slug === "extra-user")?.quantity).toBe(2)
    expect(quote.recurringAmount).toBe(99.7)
    expect(quote.adjustments).toEqual([])
  })

  it("cobra o crédito adicional pago registrado como ajuste manual de capacidade", () => {
    const quote = new BillingQuoteService().createQuote({
      billingOwnerId: "owner-1",
      billingCycle: "monthly",
      baseProduct: { productId: "base", slug: "crm", name: "CRM", unitAmount: 59.9 },
      extraUserProduct: { productId: "extra-user", slug: "extra-user", name: "Usuário adicional", unitAmount: 19.9 },
      extraTeamProduct: { productId: "extra-team", slug: "extra-team", name: "Time adicional", unitAmount: 29.9 },
      billableActiveMembers: 1,
      activeTeams: 1,
      includedExtraUsers: 0,
      includedExtraTeams: 0,
      manualAdjustmentExtraUsers: 1,
      manualAdjustmentExtraTeams: 1,
      currentAsaasAmount: 109.7,
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
    })

    expect(quote.products.find((product) => product.slug === "extra-user")?.quantity).toBe(1)
    expect(quote.products.find((product) => product.slug === "extra-team")?.quantity).toBe(1)
    expect(quote.recurringAmount).toBe(109.7)
    expect(quote.adjustments).toEqual([])
  })

  it("isenta somente o produto base da assinatura permanente e mantém extras cobrados", () => {
    const quote = new BillingQuoteService().createQuote({
      billingOwnerId: "owner-1",
      billingCycle: "monthly",
      baseProduct: { productId: "base", slug: "crm", name: "CRM", unitAmount: 59.9 },
      extraUserProduct: { productId: "extra-user", slug: "extra-user", name: "Usuário adicional", unitAmount: 19.9 },
      extraTeamProduct: { productId: "extra-team", slug: "extra-team", name: "Time adicional", unitAmount: 29.9 },
      billableActiveMembers: 2,
      activeTeams: 2,
      includedExtraUsers: 0,
      includedExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      currentAsaasAmount: 49.8,
      hasPermanentSubscription: true,
      hasUnlimitedUsers: false,
    })

    expect(quote.products.map((product) => product.slug)).toEqual(["extra-user", "extra-team"])
    expect(quote.recurringAmount).toBe(49.8)
    expect(quote.status).toBe("aligned")
  })

  it("bloqueia a projeção quando o valor recebido do Asaas não é válido", () => {
    const quote = new BillingQuoteService().createQuote({
      billingOwnerId: "owner-1",
      billingCycle: "monthly",
      baseProduct: { productId: "base", slug: "crm", name: "CRM", unitAmount: 59.9 },
      extraUserProduct: null,
      extraTeamProduct: null,
      billableActiveMembers: 1,
      activeTeams: 1,
      includedExtraUsers: 0,
      includedExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      currentAsaasAmount: Number.NaN,
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
    })

    expect(quote.status).toBe("blocked")
    expect(quote.blockingReasons).toContain("Valor da assinatura Asaas inválido")
  })

  it("bloqueia produto que não tem preço no ciclo contratado", () => {
    const quote = new BillingQuoteService().createQuote({
      billingOwnerId: "owner-1",
      billingCycle: "quarterly",
      baseProduct: null,
      extraUserProduct: null,
      extraTeamProduct: null,
      billableActiveMembers: 1,
      activeTeams: 1,
      includedExtraUsers: 0,
      includedExtraTeams: 0,
      manualAdjustmentExtraUsers: 0,
      manualAdjustmentExtraTeams: 0,
      currentAsaasAmount: 59.9,
      hasPermanentSubscription: false,
      hasUnlimitedUsers: false,
    })

    expect(quote.status).toBe("blocked")
    expect(quote.blockingReasons).toContain("Produto base sem preço vigente")
  })
})
