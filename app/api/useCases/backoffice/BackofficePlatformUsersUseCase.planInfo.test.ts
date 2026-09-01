import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const { getPlanInfo } = await import("./BackofficePlatformUsersUseCase")

describe("getPlanInfo — T-50.13 (§7.7: coluna Plano correta por construção)", () => {
  it("Member PRO trimestral com valor gravado 91,40 → rótulo real, cobrado 91,40, tabela 274,20 visível", () => {
    const plan = getPlanInfo(false, "manager_base", {
      productName: "Member PRO",
      cycle: "quarterly",
      chargedAmount: 91.4,
      listAmount: 274.2,
    })

    expect(plan.label).toBe("Member PRO — Trimestral")
    expect(plan.amount).toBe(91.4)
    expect(plan.listAmount).toBe(274.2)
    expect(plan.kind).toBe("monthly")
  })

  it("master com assinatura mensal de 79,90 NÃO sai como R$ 59,90 (hardcode morto)", () => {
    const plan = getPlanInfo(false, "manager_base", {
      productName: "CRM",
      cycle: "monthly",
      chargedAmount: 79.9,
      listAmount: 79.9,
    })

    expect(plan.amount).toBe(79.9)
    expect(plan.amount).not.toBe(59.9)
    expect(plan.label).not.toBe("Mensal")
  })
})

describe("getPlanInfo — T-50.14", () => {
  it("sem assinatura nem adesão → Sem plano ativo, amount null", () => {
    const plan = getPlanInfo(false, null, null)

    expect(plan.label).toBe("Sem plano ativo")
    expect(plan.amount).toBeNull()
    expect(plan.listAmount).toBeNull()
    expect(plan.kind).toBe("none")
  })

  it("hasPermanentSubscription → Vitalício (regressão)", () => {
    const plan = getPlanInfo(true, "manager_base", {
      productName: "CRM",
      cycle: "monthly",
      chargedAmount: 79.9,
      listAmount: 79.9,
    })

    expect(plan.label).toBe("Vitalício")
    expect(plan.amount).toBeNull()
    expect(plan.kind).toBe("lifetime")
  })

  it("subscriptionPlan free_trial → Trial (regressão)", () => {
    const plan = getPlanInfo(false, "free_trial", null)

    expect(plan.label).toBe("Trial")
    expect(plan.kind).toBe("trial")
  })
})
