import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { TeamCheckoutMasterProfile } from "@/app/api/infra/data/repositories/teamCheckout/ITeamCheckoutRepository"

const shouldBypassIncrementalChargeMock = mock(async () => false)
const syncUsageToSubscriptionMock = mock(async () => {})

mock.module("@/app/api/useCases/billing/MemberProBillingUseCase", () => ({
  memberProBillingUseCase: {
    shouldBypassIncrementalCharge: shouldBypassIncrementalChargeMock,
    syncUsageToSubscription: syncUsageToSubscriptionMock,
  },
}))

const sendAddOnConfirmedEmailMock = mock(async () => {})
const sendAddOnPendingPaymentEmailMock = mock(async () => {})

mock.module("@/lib/services/EmailService", () => ({
  emailService: {
    sendAddOnConfirmedEmail: sendAddOnConfirmedEmailMock,
    sendAddOnPendingPaymentEmail: sendAddOnPendingPaymentEmailMock,
  },
}))

mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://app.local${path}`,
}))

const { CreateTeamCheckoutUseCase } = await import("./CreateTeamCheckoutUseCase")

const MASTER_BASE: TeamCheckoutMasterProfile = {
  id: "master-1",
  fullName: "Master Um",
  email: "master@example.com",
  hasPermanentSubscription: false,
  cpfCnpj: null,
  phone: null,
  postalCode: null,
  address: null,
  addressNumber: null,
  neighborhood: null,
  complement: null,
  asaasCustomerId: "cus_1",
  asaasSubscriptionId: "sub_1",
  subscriptionStatus: "active" as const,
  subscriptionNextDueDate: null,
  subscriptionEndDate: null,
  subscriptionCycle: "MONTHLY",
  timezone: "America/Sao_Paulo",
}

const REQUESTER = {
  id: "profile-1",
  fullName: "Requester",
  email: "req@example.com",
  functions: [] as never[],
}

const INPUT = {
  requesterProfileId: "profile-1",
  masterProfileId: "master-1",
  teamName: "Novo Time",
  billingType: "PIX" as const,
  requesterRole: "manager" as const,
  requesterFunctions: [] as never[],
}

function makeRepository(master: TeamCheckoutMasterProfile | null, requester: typeof REQUESTER | null = REQUESTER) {
  return {
    findRequesterProfile: mock(async () => requester),
    findMasterProfile: mock(async () => master),
    createTeamWithMember: mock(async () => ({ teamId: "team-1" })),
    createPendingAction: mock(async () => ({ id: "pa-1" })),
  }
}

function makeBillingService(overrides: Partial<{ billingDelta: number; totalCharge: number }> = {}) {
  return {
    projectBilling: mock(async () => ({}) as never),
    createIncrementalCharge: mock(async () => ({}) as never),
    syncRecurringSubscription: mock(async () => {}),
    ensureOrSyncRecurringSubscription: mock(async () => {}),
    calculateProportionalAmount: mock(async () => ({
      billingDelta: overrides.billingDelta ?? 0,
      totalCharge: overrides.totalCharge ?? 0,
      remainingMonths: 6,
      maxInstallments: 1,
    })),
  }
}

beforeEach(() => {
  shouldBypassIncrementalChargeMock.mockReset()
  shouldBypassIncrementalChargeMock.mockResolvedValue(false)
  syncUsageToSubscriptionMock.mockClear()
  sendAddOnConfirmedEmailMock.mockClear()
  sendAddOnPendingPaymentEmailMock.mockClear()
})

describe("CreateTeamCheckoutUseCase — regressão pós-refactor (achado codex[bot] no PR #1134)", () => {
  it("perfil não encontrado → Output inválido, nenhuma escrita", async () => {
    const repository = makeRepository(null)
    const useCase = new CreateTeamCheckoutUseCase(repository, makeBillingService())

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Perfil não encontrado"])
    expect(repository.createTeamWithMember).not.toHaveBeenCalled()
  })

  it("master com hasPermanentSubscription → cria time sem cobrança, envia e-mail de confirmação", async () => {
    const repository = makeRepository({ ...MASTER_BASE, hasPermanentSubscription: true })
    const billingService = makeBillingService()
    const useCase = new CreateTeamCheckoutUseCase(repository, billingService)

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ created: true })
    expect(repository.createTeamWithMember).toHaveBeenCalledWith({
      masterId: "master-1",
      teamName: "Novo Time",
      memberProfileId: "profile-1",
      memberRole: "manager",
      memberFunctions: [],
    })
    expect(sendAddOnConfirmedEmailMock).toHaveBeenCalledTimes(1)
    expect(billingService.calculateProportionalAmount).not.toHaveBeenCalled()
  })

  it("Member PRO com bypass → cria time sem cobrança e sincroniza uso, sem chamar billing proporcional", async () => {
    shouldBypassIncrementalChargeMock.mockResolvedValue(true)
    const repository = makeRepository(MASTER_BASE)
    const billingService = makeBillingService()
    const useCase = new CreateTeamCheckoutUseCase(repository, billingService)

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(true)
    expect(repository.createTeamWithMember).toHaveBeenCalled()
    expect(syncUsageToSubscriptionMock).toHaveBeenCalledWith("master-1", "add_team")
    expect(billingService.calculateProportionalAmount).not.toHaveBeenCalled()
  })

  it("sem assinatura ativa (status null) → Output inválido, nenhuma escrita", async () => {
    const repository = makeRepository({ ...MASTER_BASE, subscriptionStatus: null })
    const useCase = new CreateTeamCheckoutUseCase(repository, makeBillingService())

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Master nao possui assinatura ativa"])
    expect(repository.createTeamWithMember).not.toHaveBeenCalled()
  })

  it("assinatura status=canceled → Output inválido", async () => {
    const repository = makeRepository({ ...MASTER_BASE, subscriptionStatus: "canceled" })
    const useCase = new CreateTeamCheckoutUseCase(repository, makeBillingService())

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(false)
  })

  it("assinatura externa expirada (sem asaasSubscriptionId, subscriptionEndDate no passado) → Output inválido", async () => {
    const repository = makeRepository({
      ...MASTER_BASE,
      asaasSubscriptionId: null,
      subscriptionEndDate: new Date(Date.now() - 86_400_000),
    })
    const useCase = new CreateTeamCheckoutUseCase(repository, makeBillingService())

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toMatch(/expirada/i)
  })

  it("billingDelta=0 → cria time sem cobrança (bifurcação pós-cálculo proporcional)", async () => {
    const repository = makeRepository(MASTER_BASE)
    const billingService = makeBillingService({ billingDelta: 0 })
    const useCase = new CreateTeamCheckoutUseCase(repository, billingService)

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ created: true })
    expect(repository.createPendingAction).not.toHaveBeenCalled()
  })

  it("billingDelta>0 → cria PendingAction, envia e-mail de cobrança pendente, devolve checkoutUrl", async () => {
    const repository = makeRepository(MASTER_BASE)
    const billingService = makeBillingService({ billingDelta: 50, totalCharge: 50 })
    const useCase = new CreateTeamCheckoutUseCase(repository, billingService)

    const output = await useCase.execute(INPUT)

    expect(output.isValid).toBe(true)
    expect(repository.createPendingAction).toHaveBeenCalledWith(
      "master-1",
      expect.objectContaining({ billingDelta: 50, totalCharge: 50, teamName: "Novo Time" })
    )
    expect(sendAddOnPendingPaymentEmailMock).toHaveBeenCalledTimes(1)
    expect(output.result).toEqual({
      pendingActionId: "pa-1",
      checkoutUrl: "https://app.local/addon-checkout/pa-1",
    })
  })

  it("erro inesperado do repository → Output inválido com a mensagem do erro, não propaga exceção", async () => {
    const repository = makeRepository(MASTER_BASE)
    repository.createTeamWithMember = mock(async () => {
      throw new Error("db down")
    })
    const useCase = new CreateTeamCheckoutUseCase(repository, makeBillingService())

    const output = await useCase.execute({ ...INPUT, requesterProfileId: "profile-1" })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["db down"])
  })
})
