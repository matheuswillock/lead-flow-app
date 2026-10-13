import { describe, expect, it } from "bun:test"
import { buildAsaasBatchMigrationPlan } from "./asaasBatchMigrationPlan"

const legacyCustomer = {
  id: "cus_legacy",
  name: "Cliente PIX",
  email: "pix@example.com",
  cpfCnpj: "12345678000199",
  notificationDisabled: true,
  externalReference: "profile-1",
}

function subscription(overrides: Partial<Parameters<typeof buildAsaasBatchMigrationPlan>[0]["legacySubscriptions"][number]> = {}) {
  return {
    id: "sub_legacy",
    customer: "cus_legacy",
    billingType: "PIX",
    status: "ACTIVE",
    value: 59.9,
    nextDueDate: "2026-11-30",
    cycle: "MONTHLY",
    ...overrides,
  }
}

describe("buildAsaasBatchMigrationPlan", () => {
  it("planeja PIX e boleto preservando valor, ciclo e vencimento", () => {
    const plan = buildAsaasBatchMigrationPlan({
      legacyCustomers: [legacyCustomer],
      legacySubscriptions: [subscription()],
      primaryCustomers: [{ ...legacyCustomer, id: "cus_primary", externalReference: "profile-1" }],
      profileByLegacyCustomerId: { cus_legacy: "profile-1" },
    })

    expect(plan).toEqual([
      expect.objectContaining({
        action: "migrate",
        legacySubscriptionId: "sub_legacy",
        primaryCustomerId: "cus_primary",
        cycle: "MONTHLY",
        value: 59.9,
        nextDueDate: "2026-11-30",
        externalReference: "asaas-migration:batch:sub_legacy",
      }),
    ])
  })

  it("bloqueia cartão sem iniciar reautorização ou cobrança", () => {
    const plan = buildAsaasBatchMigrationPlan({
      legacyCustomers: [legacyCustomer],
      legacySubscriptions: [subscription({ billingType: "CREDIT_CARD" })],
      primaryCustomers: [{ ...legacyCustomer, id: "cus_primary", externalReference: "profile-1" }],
      profileByLegacyCustomerId: { cus_legacy: "profile-1" },
    })

    expect(plan[0]).toMatchObject({ action: "block_access", reason: "credit_card_requires_manual_block" })
    expect(plan[0]?.primarySubscriptionId).toBeUndefined()
  })

  it("bloqueia customer sem owner e correspondência primary ambígua", () => {
    const plan = buildAsaasBatchMigrationPlan({
      legacyCustomers: [legacyCustomer, { ...legacyCustomer, id: "cus_orphan", externalReference: undefined }],
      legacySubscriptions: [subscription(), subscription({ id: "sub_orphan", customer: "cus_orphan" })],
      primaryCustomers: [
        { ...legacyCustomer, id: "cus_primary_a", externalReference: undefined },
        { ...legacyCustomer, id: "cus_primary_b", externalReference: undefined },
      ],
      profileByLegacyCustomerId: {},
    })

    expect(plan).toEqual([
      expect.objectContaining({ action: "blocked", legacySubscriptionId: "sub_legacy", reason: "owner_not_reconciled" }),
      expect.objectContaining({ action: "blocked", legacySubscriptionId: "sub_orphan", reason: "owner_not_reconciled" }),
    ])
  })

  it("mantém PIX elegível quando o customer primary ainda precisa ser criado", () => {
    const plan = buildAsaasBatchMigrationPlan({
      legacyCustomers: [legacyCustomer],
      legacySubscriptions: [subscription()],
      primaryCustomers: [],
      profileByLegacyCustomerId: { cus_legacy: "profile-1" },
    })

    expect(plan[0]).toMatchObject({ action: "migrate", reason: "primary_customer_to_create" })
    expect(plan[0]?.primaryCustomerId).toBeUndefined()
  })

  it("ignora assinaturas não ativas e não duplica a assinatura primary conhecida", () => {
    const plan = buildAsaasBatchMigrationPlan({
      legacyCustomers: [legacyCustomer],
      legacySubscriptions: [subscription({ status: "INACTIVE" })],
      primaryCustomers: [{ ...legacyCustomer, id: "cus_primary", externalReference: "profile-1" }],
      primarySubscriptions: [{ id: "sub_primary", customer: "cus_primary", externalReference: "asaas-migration:batch:sub_legacy" }],
      profileByLegacyCustomerId: { cus_legacy: "profile-1" },
    })

    expect(plan).toEqual([])
  })
})
