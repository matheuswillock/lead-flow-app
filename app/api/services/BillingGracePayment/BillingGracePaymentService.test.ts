import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { RenewalAccount } from "@/app/api/shared/billing/renewalQuote"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"

const CYCLE_OPTIONS: SelfCheckoutCycleOption[] = [
  { cycle: "monthly", label: "Mensal", months: 1, pixTotal: 59.9, monthlyEquivalent: 59.9, extraUserMonthlyPrice: 19.9, extraTeamMonthlyPrice: 29.9 },
  { cycle: "quarterly", label: "Trimestral", months: 3, pixTotal: 159.9, monthlyEquivalent: 53.3, extraUserMonthlyPrice: 19.9, extraTeamMonthlyPrice: 29.9 },
]

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
} & RenewalAccount

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
  hasManualUnlimitedUsers: false,
  currentCycle: "monthly",
  currentDueDate: new Date("2026-11-01T03:00:00.000Z"),
  teams: [{ name: "Time A" }],
  extraUsers: [
    { id: "u-ana", name: "Ana", email: "ana@example.com", role: "operator" },
    { id: "u-bia", name: "Bia", email: "bia@example.com", role: "manager" },
  ],
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

let configuredEnvironment: "DEV" | "PRODUCTION" = "DEV"
const select = mock(async (input: { environment: string }) => ({
  provider: "ABACATE_PAY",
  environment: input.environment,
  externalAccountContext: "ctx",
}))
const createPaymentProviderRouter = mock((_environment: string) => ({ select }))
const createPixPayment = mock(async (_input: unknown) => ({ status: "PENDING", externalId: "ext-1", pix: { brCode: "000201" } }))
mock.module("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition", () => ({
  resolvePaymentProviderEnvironment: () => configuredEnvironment,
  createPaymentProviderRouter,
  createAbacatePayProvider: () => ({ createPixPayment }),
}))

const { BillingGracePaymentService } = await import("./BillingGracePaymentService")
const newService = () => new BillingGracePaymentService(async () => CYCLE_OPTIONS)

beforeEach(() => {
  for (const fn of [findAccountContext, findByIdempotencyKey, create, attachProviderAttempt, createSession, createAttempt, select, createPaymentProviderRouter, createPixPayment]) fn.mockClear()
  configuredEnvironment = "DEV"
  findAccountContext.mockResolvedValue(accountA)
  findByIdempotencyKey.mockResolvedValue(null)
  select.mockImplementation(async (input) => ({
    provider: "ABACATE_PAY",
    environment: input.environment,
    externalAccountContext: "ctx",
  }))
})

describe("BillingGracePaymentService.createPixPayment — ambiente e provider", () => {
  it("seleciona o provider no ambiente configurado na composition, exigindo PIX", async () => {
    configuredEnvironment = "PRODUCTION"

    await newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-1", cycle: "monthly" })

    expect(createPaymentProviderRouter).toHaveBeenCalledWith("PRODUCTION")
    expect(select).toHaveBeenCalledWith({ environment: "PRODUCTION", requiredCapabilities: ["ONE_TIME_PAYMENT", "PIX"] })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ providerEnvironment: "PRODUCTION" }))
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ environment: "PRODUCTION" }))
  })

  it("não cria a linha de regularização quando nenhum provider está disponível", async () => {
    select.mockRejectedValue(new Error("Nenhum provider disponível"))

    await expect(newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-1", cycle: "monthly" })).rejects.toThrow("Nenhum provider disponível")

    expect(create).not.toHaveBeenCalled()
    expect(createSession).not.toHaveBeenCalled()
    expect(createPixPayment).not.toHaveBeenCalled()
  })

  it("não consulta o provider quando a chave já tem pagamento da própria conta", async () => {
    findByIdempotencyKey.mockResolvedValue({ id: "payment-existing" })

    await newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-1", cycle: "monthly" })

    expect(select).not.toHaveBeenCalled()
  })
})

describe("BillingGracePaymentService.createPixPayment — escopo da chave de idempotência", () => {
  it("resolve a conta antes de qualquer consulta pela chave", async () => {
    findAccountContext.mockResolvedValue(null)

    await expect(newService().createPixPayment({ supabaseId: "sb-x", idempotencyKey: "k-1", cycle: "monthly" })).rejects.toThrow("Somente o master")

    expect(findByIdempotencyKey).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("consulta a chave escopada pela conta do chamador", async () => {
    await newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-1", cycle: "monthly" })

    expect(findByIdempotencyKey).toHaveBeenCalledWith({ accountId: "account-a", idempotencyKey: "k-1" })
  })

  it("devolve o pagamento existente da própria conta sem criar outro", async () => {
    const existing = { id: "payment-existing", accountId: "account-a" }
    findByIdempotencyKey.mockResolvedValue(existing)

    const result = await newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-1", cycle: "monthly" })

    expect(result as unknown).toBe(existing)
    expect(create).not.toHaveBeenCalled()
  })

  it("não devolve o pagamento de outra conta que usou a mesma chave: cria um novo para o chamador", async () => {
    // O pagamento da conta A existe, mas a consulta escopada da conta B não o enxerga.
    findAccountContext.mockResolvedValue(accountB)
    findByIdempotencyKey.mockImplementation(async ({ accountId }) => (accountId === "account-a" ? { id: "payment-of-a" } : null))

    const result = (await newService().createPixPayment({ supabaseId: "sb-b", idempotencyKey: "shared-key", cycle: "monthly" })) as { id: string }

    expect(result.id).toBe("payment-of-account-b")
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ accountId: "account-b", idempotencyKey: "shared-key", cycle: "monthly" }))
  })

  it("deriva as chaves de sessão e tentativa do provider do id do pagamento, não da chave do cliente", async () => {
    await newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "shared-key", cycle: "monthly" })
    findAccountContext.mockResolvedValue(accountB)
    await newService().createPixPayment({ supabaseId: "sb-b", idempotencyKey: "shared-key", cycle: "monthly" })

    const sessionKeys = createSession.mock.calls.map(([input]) => input.idempotencyKey)
    const attemptKeys = createAttempt.mock.calls.map(([input]) => input.idempotencyKey)
    expect(sessionKeys).toEqual(["billing-grace-payment:payment-of-account-a", "billing-grace-payment:payment-of-account-b"])
    expect(attemptKeys).toEqual(sessionKeys)
    expect(new Set(attemptKeys).size).toBe(2)
  })
})

describe("BillingGracePaymentService — prazo escolhido", () => {
  it("cobra o prazo escolhido com os adicionais nominais e grava o ciclo", async () => {
    await newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-2", cycle: "quarterly" })

    // Trimestral 159,90 + 2 usuários adicionais (Ana e a manager Bia) 2 x 19,90 x 3 meses = 119,40; o único time é o incluído.
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cycle: "quarterly", amountCents: 27930, revokedProfileIds: [] }))
    expect(createPixPayment).toHaveBeenCalledWith(expect.objectContaining({ amountInCents: 27930 }))
  })

  it("cobra só os usuários mantidos e grava quem será revogado", async () => {
    await newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-4", cycle: "monthly", keptUserIds: ["u-bia"] })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 7980, revokedProfileIds: ["u-ana"] }))
  })

  it("recusa manter um usuário que não é da conta", async () => {
    await expect(newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-5", cycle: "monthly", keptUserIds: ["u-outra-conta"] }))
      .rejects.toThrow("A lista de usuários mudou")

    expect(create).not.toHaveBeenCalled()
  })

  it("recusa prazo fora da tabela vigente sem criar a cobrança", async () => {
    await expect(newService().createPixPayment({ supabaseId: "sb-a", idempotencyKey: "k-3", cycle: "member_pro_100" }))
      .rejects.toThrow("Este prazo não está disponível")

    expect(create).not.toHaveBeenCalled()
  })

  it("a cotação lista cada prazo com quem está sendo cobrado", async () => {
    const quote = await newService().getQuote("sb-a")

    expect(quote.cycles.map((cycle) => cycle.cycle)).toEqual(["monthly", "quarterly"])
    expect(quote.cycles[0].billedUsers.map((user) => user.id)).toEqual(["u-ana", "u-bia"])
    expect(quote.cycles[0].periodStart).toBe("2026-11-01T03:00:00.000Z")
  })
})
