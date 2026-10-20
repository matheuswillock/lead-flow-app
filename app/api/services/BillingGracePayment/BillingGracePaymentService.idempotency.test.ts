import { beforeEach, describe, expect, it, mock } from "bun:test"

type Account = {
  accountId: string
  teamId: string | null
  subscriptionId: string | null
  name: string
  email: string
  taxId: string
  cellphone: string
  hasUnlimitedUsers: boolean
  hasPermanentSubscription: boolean
  teamCount: number
  distinctUserCount: number
  totalUsersIncludingMaster: number
}

const accountA: Account = {
  accountId: "account-a",
  teamId: "team-a",
  subscriptionId: "sub-a",
  name: "Conta A",
  email: "a@example.com",
  taxId: "12345678909",
  cellphone: "11999999999",
  hasUnlimitedUsers: false,
  hasPermanentSubscription: false,
  teamCount: 1,
  distinctUserCount: 2,
  totalUsersIncludingMaster: 2,
}
const accountB: Account = { ...accountA, accountId: "account-b", teamId: "team-b", subscriptionId: "sub-b", email: "b@example.com" }

const findAccountContext = mock(async (_supabaseId: string): Promise<Account | null> => accountA)
const findByIdempotencyKey = mock(async (_input: { accountId: string; idempotencyKey: string }): Promise<unknown> => null)
const create = mock(async (input: { accountId: string }) => ({ id: `payment-of-${input.accountId}` }))
const attachProviderAttempt = mock(async (input: { id: string }) => ({ id: input.id, attached: true }))
mock.module("@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository", () => ({
  billingGracePaymentRepository: { findAccountContext, findByIdempotencyKey, create, attachProviderAttempt },
}))

const createSession = mock(async (_input: { idempotencyKey: string }) => ({ id: "session-1" }))
const createAttempt = mock(async (_input: { idempotencyKey: string }) => ({ id: "attempt-1" }))
mock.module("@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository", () => ({
  paymentProviderSessionRepository: {
    createSession,
    createAttempt,
    acquireAttemptLease: mock(async () => ({ id: "attempt-1", lease: "lease-1" })),
    updateAttemptWithLease: mock(async () => ({ id: "attempt-1", externalId: "ext-1", paymentInstructions: null })),
  },
}))

mock.module("@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository", () => ({
  PaymentProviderConfigRepository: class {},
}))
mock.module("@/lib/payment-provider/registry", () => ({ PaymentProviderRegistry: class {} }))
mock.module("@/lib/payment-provider/router", () => ({
  PaymentProviderRouter: class {
    select = async () => ({ provider: "ABACATE_PAY", environment: "DEV", externalAccountContext: "ctx" })
  },
}))
mock.module("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition", () => ({
  resolvePaymentProviderEnvironment: () => "DEV",
  createAbacatePayProvider: () => ({
    createPixPayment: async () => ({ status: "PENDING", externalId: "ext-1", pix: { brCode: "000201" } }),
  }),
}))

const { BillingGracePaymentService } = await import("./BillingGracePaymentService")

beforeEach(() => {
  for (const fn of [findAccountContext, findByIdempotencyKey, create, attachProviderAttempt, createSession, createAttempt]) fn.mockClear()
  findAccountContext.mockResolvedValue(accountA)
  findByIdempotencyKey.mockResolvedValue(null)
})

describe("BillingGracePaymentService.createPixPayment — escopo da chave de idempotência", () => {
  it("resolve a conta antes de qualquer consulta pela chave", async () => {
    findAccountContext.mockResolvedValue(null)

    await expect(new BillingGracePaymentService().createPixPayment({ supabaseId: "sb-x", idempotencyKey: "k-1" })).rejects.toThrow("Somente o master")

    expect(findByIdempotencyKey).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("consulta a chave escopada pela conta do chamador", async () => {
    await new BillingGracePaymentService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-1" })

    expect(findByIdempotencyKey).toHaveBeenCalledWith({ accountId: "account-a", idempotencyKey: "k-1" })
  })

  it("devolve o pagamento existente da própria conta sem criar outro", async () => {
    const existing = { id: "payment-existing", accountId: "account-a" }
    findByIdempotencyKey.mockResolvedValue(existing)

    const result = await new BillingGracePaymentService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-1" })

    expect(result as unknown).toBe(existing)
    expect(create).not.toHaveBeenCalled()
  })

  it("não devolve o pagamento de outra conta que usou a mesma chave: cria um novo para o chamador", async () => {
    // O pagamento da conta A existe, mas a consulta escopada da conta B não o enxerga.
    findAccountContext.mockResolvedValue(accountB)
    findByIdempotencyKey.mockImplementation(async ({ accountId }) => (accountId === "account-a" ? { id: "payment-of-a" } : null))

    const result = (await new BillingGracePaymentService().createPixPayment({ supabaseId: "sb-b", idempotencyKey: "shared-key" })) as { id: string }

    expect(result.id).toBe("payment-of-account-b")
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ accountId: "account-b", idempotencyKey: "shared-key" }))
  })

  it("deriva as chaves de sessão e tentativa do provider do id do pagamento, não da chave do cliente", async () => {
    await new BillingGracePaymentService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "shared-key" })
    findAccountContext.mockResolvedValue(accountB)
    await new BillingGracePaymentService().createPixPayment({ supabaseId: "sb-b", idempotencyKey: "shared-key" })

    const sessionKeys = createSession.mock.calls.map(([input]) => input.idempotencyKey)
    const attemptKeys = createAttempt.mock.calls.map(([input]) => input.idempotencyKey)
    expect(sessionKeys).toEqual(["billing-grace-payment:payment-of-account-a", "billing-grace-payment:payment-of-account-b"])
    expect(attemptKeys).toEqual(sessionKeys)
    expect(new Set(attemptKeys).size).toBe(2)
  })
})
