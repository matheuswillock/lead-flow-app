import { beforeEach, describe, expect, it, mock } from "bun:test"
import { PaymentProviderRegistry } from "@/lib/payment-provider/registry"
import { PaymentProviderRouter } from "@/lib/payment-provider/router"
import type { ProviderRoutingConfigRecord } from "@/lib/payment-provider/routing-config"

// Fase B / B1: uma cobrança NOVA de add-on (PIX ou CREDIT_CARD) nasce somente pelo
// roteador de provedores (ABACATE_PAY). O cliente Asaas nunca é chamado.

const abacateConfig: ProviderRoutingConfigRecord = {
  provider: "ABACATE_PAY",
  environment: "DEV",
  enabled: true,
  isDefault: true,
  rolloutState: "ACTIVE",
  killSwitch: false,
  cardEnabled: false,
  externalAccountContext: "abacate-dev",
  revision: 1,
  healthStatus: "HEALTHY",
}

const asaasConfigNotDefault: ProviderRoutingConfigRecord = {
  ...abacateConfig,
  provider: "ASAAS",
  isDefault: false,
  externalAccountContext: "asaas-primary",
}

const asaasConfigDefault: ProviderRoutingConfigRecord = {
  ...asaasConfigNotDefault,
  isDefault: true,
}

let providerConfigRows: readonly ProviderRoutingConfigRecord[] = [abacateConfig]

const configRepositoryMock = {
  list: mock(async (_environment: string) => providerConfigRows),
}

// Mesmo registro da composição (createAbacatePayProviderRegistry): só ABACATE_PAY existe.
const providerRegistry = new PaymentProviderRegistry([
  {
    metadata: {
      key: "ABACATE_PAY",
      environment: "DEV",
      capabilities: ["ONE_TIME_PAYMENT", "PIX", "CARD", "STATUS_QUERY", "FULL_REFUND", "WEBHOOK"],
    },
  },
])
const providerRouter = new PaymentProviderRouter(configRepositoryMock, providerRegistry)
const routerSelectMock = mock(async (input: Parameters<PaymentProviderRouter["select"]>[0]) =>
  providerRouter.select(input)
)

const pixPaymentMock = mock(async (_input: unknown) => ({
  status: "PENDING",
  externalId: "bill_1",
  method: "PIX",
  pix: { brCode: "copia-cola", brCodeBase64: "img", expiresAt: "2026-12-01T00:00:00.000Z" },
}))
const cardPaymentMock = mock(async (_input: unknown) => ({
  status: "PENDING",
  externalId: "bill_1",
  method: "CARD",
}))
const abacatePayProviderFactoryMock = mock(async (_environment: string, _externalAccountContext?: string) => ({
  createPixPayment: pixPaymentMock,
  createCardPayment: cardPaymentMock,
}))

const createSessionMock = mock(async (_input: unknown) => ({ id: "session-1" }))
const createAttemptMock = mock(async (_input: unknown) => ({ id: "attempt-1" }))
const acquireAttemptLeaseMock = mock(async (_input: unknown) => ({
  id: "attempt-1",
  status: "CREATED",
  lease: { token: "lease" },
}))
const updateAttemptWithLeaseMock = mock(async (_input: unknown) => ({
  id: "attempt-1",
  externalId: "bill_1",
  status: "PENDING",
}))
const attachProviderAttemptMock = mock(async (_input: unknown) => ({}))
const createCustomerMock = mock(async (_input: unknown) => ({ id: "cus_gateway" }))
const asaasFetchMock = mock(async (_endpoint: unknown, _options?: unknown) => {
  throw new Error("asaasFetch não deveria ser chamado numa cobrança AbacatePay")
})
const createAsaasClientMock = mock((_account: unknown) => {
  throw new Error("createAsaasClient não deveria ser chamado numa cobrança AbacatePay")
})

mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: createCustomerMock },
}))

mock.module("@/app/api/infra/data/repositories/billing/BillingRepository", () => ({
  billingRepository: {
    getBillingSnapshot: mock(async () => null),
    updateAsaasCustomerId: mock(async () => {}),
    updateSubscriptionData: mock(async () => {}),
    getSubscriptionEndDate: mock(async () => null),
  },
}))

mock.module("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition", () => ({
  resolvePaymentProviderEnvironment: () => "DEV",
  createPaymentProviderRouter: async () => ({ select: routerSelectMock }),
  createAbacatePayProvider: abacatePayProviderFactoryMock,
}))

mock.module("@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository", () => ({
  paymentProviderSessionRepository: {
    createSession: createSessionMock,
    createAttempt: createAttemptMock,
    acquireAttemptLease: acquireAttemptLeaseMock,
    updateAttemptWithLease: updateAttemptWithLeaseMock,
  },
}))

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: { attachProviderAttempt: attachProviderAttemptMock },
}))

mock.module("@/lib/asaas", () => ({
  asaasApi: { subscriptions: "/subscriptions", payments: "/payments", customers: "/customers" },
  asaasFetch: asaasFetchMock,
  createAsaasClient: createAsaasClientMock,
}))

const { IncrementalBillingService } = await import("./IncrementalBillingService")

const baseMaster = {
  id: "profile-master-1",
  fullName: "Master Teste",
  email: "master@example.test",
  cpfCnpj: "12345678901",
  phone: null,
  postalCode: null,
  address: null,
  addressNumber: null,
  neighborhood: null,
  complement: null,
  asaasCustomerId: null,
  asaasCustomerAccount: "primary" as const,
  asaasSubscriptionId: null,
  asaasSubscriptionAccount: "primary" as const,
  subscriptionStatus: "active",
  subscriptionNextDueDate: null,
  subscriptionCycle: "MONTHLY",
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  timezone: "America/Sao_Paulo",
}

const pixChargeInput = {
  master: baseMaster,
  pendingActionId: "pa-1",
  amount: 10,
  description: "Licença Usuário: Operador",
  billingType: "PIX" as const,
}

const cardChargeInput = {
  ...pixChargeInput,
  billingType: "CREDIT_CARD" as const,
  cardToken: "card-token-1",
  installments: 1,
}

const expectNoAsaasCall = () => {
  expect(createAsaasClientMock).not.toHaveBeenCalled()
  expect(asaasFetchMock).not.toHaveBeenCalled()
  expect(createCustomerMock).not.toHaveBeenCalled()
}

describe("IncrementalBillingService — cobrança nova de add-on só via ABACATE_PAY", () => {
  beforeEach(() => {
    providerConfigRows = [abacateConfig]
    configRepositoryMock.list.mockClear()
    routerSelectMock.mockClear()
    abacatePayProviderFactoryMock.mockClear()
    pixPaymentMock.mockClear()
    cardPaymentMock.mockClear()
    createSessionMock.mockClear()
    createAttemptMock.mockClear()
    acquireAttemptLeaseMock.mockClear()
    updateAttemptWithLeaseMock.mockClear()
    attachProviderAttemptMock.mockClear()
    createCustomerMock.mockClear()
    asaasFetchMock.mockClear()
    createAsaasClientMock.mockClear()
  })

  it("(a) cobrança PIX passa pelo roteador e pelo ABACATE_PAY, sem Asaas", async () => {
    const result = await new IncrementalBillingService().createIncrementalCharge(pixChargeInput)

    expect(routerSelectMock).toHaveBeenCalledTimes(1)
    expect(routerSelectMock.mock.calls[0]?.[0]).toEqual({
      environment: "DEV",
      requiredCapabilities: ["ONE_TIME_PAYMENT", "PIX"],
    })
    expect(abacatePayProviderFactoryMock).toHaveBeenCalledWith("DEV", "abacate-dev")
    expect(pixPaymentMock).toHaveBeenCalledTimes(1)
    expect(cardPaymentMock).not.toHaveBeenCalled()
    expect(result.paymentId).toBe("provider-bill_1")
    expect(result.billingType).toBe("PIX")
    expect(result.pix?.payload).toBe("copia-cola")
    expectNoAsaasCall()
  })

  it("(b) cobrança CREDIT_CARD passa pelo roteador e pelo ABACATE_PAY, sem Asaas", async () => {
    const result = await new IncrementalBillingService().createIncrementalCharge(cardChargeInput)

    expect(routerSelectMock).toHaveBeenCalledTimes(1)
    expect(routerSelectMock.mock.calls[0]?.[0]).toEqual({
      environment: "DEV",
      requiredCapabilities: ["ONE_TIME_PAYMENT", "CARD"],
    })
    expect(abacatePayProviderFactoryMock).toHaveBeenCalledWith("DEV", "abacate-dev")
    expect(cardPaymentMock).toHaveBeenCalledTimes(1)
    expect(pixPaymentMock).not.toHaveBeenCalled()
    expect(result.paymentId).toBe("provider-bill_1")
    expect(result.billingType).toBe("CREDIT_CARD")
    expectNoAsaasCall()
  })

  it("(c) o roteador só seleciona ABACATE_PAY, mesmo com uma linha ASAAS ativa na configuração", async () => {
    providerConfigRows = [abacateConfig, asaasConfigNotDefault]

    await new IncrementalBillingService().createIncrementalCharge(pixChargeInput)

    expect(createSessionMock).toHaveBeenCalledTimes(1)
    expect(createSessionMock.mock.calls[0]?.[0]).toMatchObject({
      provider: "ABACATE_PAY",
      environment: "DEV",
      externalAccountContext: "abacate-dev",
    })
    expect(attachProviderAttemptMock.mock.calls[0]?.[0]).toMatchObject({ provider: "ABACATE_PAY" })
    expect(abacatePayProviderFactoryMock).toHaveBeenCalledWith("DEV", "abacate-dev")
    expectNoAsaasCall()
  })

  it("(c) ASAAS como provedor padrão faz a cobrança falhar, sem cair no Asaas", async () => {
    providerConfigRows = [asaasConfigDefault, { ...abacateConfig, isDefault: false }]

    await expect(new IncrementalBillingService().createIncrementalCharge(pixChargeInput)).rejects.toMatchObject({
      code: "PROVIDER_DEFAULT_INVALID",
    })

    expect(createSessionMock).not.toHaveBeenCalled()
    expect(pixPaymentMock).not.toHaveBeenCalled()
    expect(cardPaymentMock).not.toHaveBeenCalled()
    expectNoAsaasCall()
  })
})
