import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const {
  resolveKnownAsaasAccounts,
  fetchPaymentsAcrossAccounts,
  findPaymentAcrossAccounts,
  guardLegacyInvoiceWrite,
} = await import("./BackofficePlatformUsersUseCase")

describe("resolveKnownAsaasAccounts — T-50.6 (fan-out de leitura)", () => {
  it("profile sem cus_ legado → uma conta só (primary)", () => {
    const accounts = resolveKnownAsaasAccounts(
      { asaasCustomerId: "cus_primary_1", asaasCustomerAccount: "primary" },
      []
    )

    expect(accounts).toEqual([{ account: "primary", customerId: "cus_primary_1" }])
  })

  it("adesão histórica com cus_ legado → duas contas, primary primeiro", () => {
    const accounts = resolveKnownAsaasAccounts(
      { asaasCustomerId: "cus_primary_1", asaasCustomerAccount: "primary" },
      [
        { id: "adh-1", productName: "CRM", installmentLedger: [], paidAt: null, createdAt: new Date(), asaasCustomerId: "cus_legacy_1", asaasAccount: "legacy" },
      ]
    )

    expect(accounts).toEqual([
      { account: "primary", customerId: "cus_primary_1" },
      { account: "legacy", customerId: "cus_legacy_1" },
    ])
  })

  it("dedupe: adesão na mesma conta/customerId do profile não duplica", () => {
    const accounts = resolveKnownAsaasAccounts(
      { asaasCustomerId: "cus_primary_1", asaasCustomerAccount: "primary" },
      [
        { id: "adh-1", productName: "CRM", installmentLedger: [], paidAt: null, createdAt: new Date(), asaasCustomerId: "cus_primary_1", asaasAccount: "primary" },
      ]
    )

    expect(accounts).toEqual([{ account: "primary", customerId: "cus_primary_1" }])
  })

  it("profile sem asaasCustomerId nenhum → array vazio", () => {
    const accounts = resolveKnownAsaasAccounts({ asaasCustomerId: null, asaasCustomerAccount: "primary" }, [])
    expect(accounts).toEqual([])
  })
})

describe("fetchPaymentsAcrossAccounts — T-50.6 (merge ordenado, account anotado)", () => {
  it("mescla payments das duas contas ordenados por dueDate, cada um com account correto", async () => {
    const clientFactory = (account: "primary" | "legacy") => ({
      endpoints: { payments: `https://asaas.test/${account}/payments` },
      request: mock(async () => ({
        data:
          account === "primary"
            ? [{ id: "pay_new_1", dueDate: "2026-09-10" }]
            : [{ id: "pay_old_1", dueDate: "2026-08-01" }],
        totalCount: 1,
      })),
    })

    const payments = await fetchPaymentsAcrossAccounts(
      [
        { account: "primary", customerId: "cus_primary_1" },
        { account: "legacy", customerId: "cus_legacy_1" },
      ],
      clientFactory as never
    )

    expect(payments.map((p) => p.id)).toEqual(["pay_old_1", "pay_new_1"])
    expect(payments.find((p) => p.id === "pay_old_1")?.account).toBe("legacy")
    expect(payments.find((p) => p.id === "pay_new_1")?.account).toBe("primary")
  })
})

describe("findPaymentAcrossAccounts — T-50.7", () => {
  it("404 na primária → encontra na legada", async () => {
    const clientFactory = (account: "primary" | "legacy") => ({
      endpoints: { payments: `https://asaas.test/${account}/payments` },
      request: mock(async () => {
        if (account === "primary") {
          const err = new Error("not found") as Error & { statusCode?: number }
          err.statusCode = 404
          throw err
        }
        return { id: "pay_old_1", customer: "cus_legacy_1" }
      }),
    })

    const result = await findPaymentAcrossAccounts(
      "pay_old_1",
      [
        { account: "primary", customerId: "cus_primary_1" },
        { account: "legacy", customerId: "cus_legacy_1" },
      ],
      clientFactory as never
    )

    expect(result?.account).toBe("legacy")
    expect(result?.payment.id).toBe("pay_old_1")
  })

  it("404 nas duas → null (rota devolve 'Fatura não encontrada')", async () => {
    const clientFactory = () => ({
      endpoints: { payments: `https://asaas.test/payments` },
      request: mock(async () => {
        const err = new Error("not found") as Error & { statusCode?: number }
        err.statusCode = 404
        throw err
      }),
    })

    const result = await findPaymentAcrossAccounts(
      "pay_missing",
      [
        { account: "primary", customerId: "cus_primary_1" },
        { account: "legacy", customerId: "cus_legacy_1" },
      ],
      clientFactory as never
    )

    expect(result).toBeNull()
  })

  it("ownership: payment de outro customer em qualquer conta é ignorado (segue procurando)", async () => {
    const clientFactory = (account: "primary" | "legacy") => ({
      endpoints: { payments: `https://asaas.test/${account}/payments` },
      request: mock(async () => ({
        id: "pay_x",
        customer: account === "primary" ? "cus_OUTRO_CLIENTE" : "cus_legacy_1",
      })),
    })

    const result = await findPaymentAcrossAccounts(
      "pay_x",
      [
        { account: "primary", customerId: "cus_primary_1" },
        { account: "legacy", customerId: "cus_legacy_1" },
      ],
      clientFactory as never
    )

    expect(result?.account).toBe("legacy")
  })
})

describe("guardLegacyInvoiceWrite — T-50.8 (gate C31)", () => {
  it("payment da conta legada com gate fechado → Output inválido explícito", () => {
    const output = guardLegacyInvoiceWrite("legacy", false)

    expect(output).not.toBeNull()
    expect(output?.isValid).toBe(false)
    expect(output?.errorMessages[0]).toMatch(/conta legada/i)
  })

  it("payment da conta legada com gate aberto → null (deixa a escrita seguir)", () => {
    const output = guardLegacyInvoiceWrite("legacy", true)
    expect(output).toBeNull()
  })

  it("payment da conta primary → null (nunca bloqueado), independente do gate", () => {
    expect(guardLegacyInvoiceWrite("primary", false)).toBeNull()
    expect(guardLegacyInvoiceWrite("primary", true)).toBeNull()
  })
})
