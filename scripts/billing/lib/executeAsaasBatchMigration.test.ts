import { describe, expect, it } from "bun:test"
import { executeAsaasBatchMigration } from "./executeAsaasBatchMigration"
import type { AsaasBatchMigrationPlanItem } from "./asaasBatchMigrationPlan"

function migratePlan(overrides: Partial<AsaasBatchMigrationPlanItem> = {}): AsaasBatchMigrationPlanItem {
  return {
    action: "migrate",
    legacyCustomerId: "cus_legacy",
    legacySubscriptionId: "sub_legacy",
    profileId: "profile-1",
    primaryCustomerId: "cus_primary",
    billingType: "PIX",
    cycle: "MONTHLY",
    value: 59.9,
    nextDueDate: "2026-11-30",
    externalReference: "asaas-migration:batch:sub_legacy",
    ...overrides,
  }
}

function gateway() {
  const calls: string[] = []
  let paymentOpen = true
  let legacyActive = true
  return {
    calls,
    findCustomerByExternalReference: async () => null,
    createCustomer: async () => {
      calls.push("create-customer")
      return { id: "cus_created" }
    },
    findSubscriptionByExternalReference: async () => null,
    createSubscription: async (input: { customerId: string; value: number; cycle: string; nextDueDate: string; externalReference: string; billingType?: string }) => {
      calls.push("create-subscription")
      return { id: "sub_primary", customer: input.customerId, value: input.value, cycle: input.cycle, nextDueDate: input.nextDueDate, status: "ACTIVE" }
    },
    listLegacySubscriptionPayments: async () => paymentOpen ? [{ id: "pay_legacy", status: "PENDING", subscription: "sub_legacy" }] : [],
    cancelLegacyPayment: async () => {
      calls.push("cancel-payment")
      paymentOpen = false
      return true
    },
    findLegacySubscription: async () => ({ id: "sub_legacy", status: legacyActive ? "ACTIVE" : "INACTIVE" }),
    inactivateLegacySubscription: async () => {
      calls.push("inactivate-legacy")
      legacyActive = false
      return { id: "sub_legacy", status: "INACTIVE" }
    },
  }
}

describe("executeAsaasBatchMigration", () => {
  it("cria a assinatura primary antes de cancelar a cobrança legacy", async () => {
    const asaas = gateway()
    const persisted: string[] = []
    const result = await executeAsaasBatchMigration({
      plans: [migratePlan()],
      apply: true,
      gateway: asaas,
      persistence: { persist: async () => { persisted.push("persist") }, blockAccess: async () => { persisted.push("block") } },
    })

    expect(result[0]).toMatchObject({ outcome: "migrated", primarySubscriptionId: "sub_primary" })
    expect(asaas.calls).toEqual(["create-subscription", "cancel-payment", "inactivate-legacy"])
    expect(persisted).toEqual(["persist"])
  })

  it("bloqueia cartão sem chamar Asaas nem persistir cobrança", async () => {
    const asaas = gateway()
    let blocked = 0
    const result = await executeAsaasBatchMigration({
      plans: [migratePlan({ action: "block_access", billingType: "CREDIT_CARD", reason: "credit_card_requires_manual_block" })],
      apply: true,
      gateway: asaas,
      persistence: { persist: async () => {}, blockAccess: async () => { blocked += 1 } },
    })

    expect(result[0]).toMatchObject({ outcome: "access_blocked" })
    expect(blocked).toBe(1)
    expect(asaas.calls).toEqual([])
  })

  it("dry-run não chama gateway nem persistência", async () => {
    const asaas = gateway()
    const result = await executeAsaasBatchMigration({
      plans: [migratePlan()],
      apply: false,
      gateway: asaas,
      persistence: { persist: async () => { throw new Error("não deveria persistir") }, blockAccess: async () => { throw new Error("não deveria bloquear") } },
    })

    expect(result[0]?.outcome).toBe("planned")
    expect(asaas.calls).toEqual([])
  })
})
