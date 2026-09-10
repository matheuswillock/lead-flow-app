import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
  BackofficeSubscriptionChangeOrderUseCase,
  SUBSCRIPTION_CHANGE_ORDER_OVERRIDE_AUTO_APPROVE_MAX_AMOUNT,
} from "./BackofficeSubscriptionChangeOrderUseCase"

mock.module("server-only", () => ({}))
mock.module("@/lib/billing/logSubscriptionChange", () => ({
  logSubscriptionChange: mock(async () => {}),
}))

const MASTER_ID = "11111111-1111-4111-8111-111111111111"
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222"
const ACTOR_PROFILE_ID = "33333333-3333-4333-8333-333333333333"
const BACKOFFICE_USER_ID = "44444444-4444-4444-8444-444444444444"

function makeBillingProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MASTER_ID,
    fullName: "Master Teste",
    email: "master@example.com",
    cpfCnpj: "12345678900",
    phone: "11999999999",
    postalCode: "01000-000",
    address: "Rua Teste",
    addressNumber: "100",
    neighborhood: "Centro",
    complement: null,
    asaasCustomerId: null,
    asaasCustomerAccount: "primary",
    ...overrides,
  }
}

function makeRepository(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findMasterContext: mock(async () => ({
      hasPermanentSubscription: false,
      currentProductId: null,
      currentCycle: null,
      currentChargedAmount: null,
      currentPeriodEnd: null,
      billingProfile: makeBillingProfile(),
    })),
    findTargetProduct: mock(async () => ({
      id: PRODUCT_ID,
      name: "CRM",
      isActive: true,
      priceMonthly: 100,
      priceQuarterly: 300,
      priceQuadrimester: null,
      priceSemiannual: null,
      priceAnnual: null,
    })),
    create: mock(async (data: any) => ({
      id: "order-1",
      masterProfileId: data.masterProfileId,
      status: "draft",
      targetProductId: data.targetProductId,
      targetProductName: "CRM",
      targetCycle: data.targetCycle,
      listAmount: data.listAmount,
      proratedAmount: data.proratedAmount,
      overrideAmount: data.overrideAmount,
      overrideStatus: data.overrideStatus,
      overrideApprovedByProfileId: data.overrideApprovedByProfileId,
      chargeAmount: data.chargeAmount,
      asaasPaymentId: null,
      asaasAccount: "primary",
      paymentInvoiceUrl: null,
      createdAt: new Date(),
    })),
    findById: mock(async () => null),
    updateMasterAsaasCustomer: mock(async () => {}),
    attachPayment: mock(async (id: string, data: any) => ({
      id,
      masterProfileId: MASTER_ID,
      status: "awaiting_payment",
      targetProductId: PRODUCT_ID,
      targetProductName: "CRM",
      targetCycle: "monthly",
      listAmount: 100,
      proratedAmount: 100,
      overrideAmount: null,
      overrideStatus: "not_required",
      overrideApprovedByProfileId: null,
      chargeAmount: 100,
      asaasPaymentId: data.asaasPaymentId,
      asaasAccount: data.asaasAccount,
      paymentInvoiceUrl: data.paymentInvoiceUrl,
      createdAt: new Date(),
    })),
    approveOverride: mock(async () => null),
    ...overrides,
  }
}

beforeEach(() => {
  delete process.env.BACKOFFICE_SUBSCRIPTION_CHANGE_ORDER_OVERRIDE_AUTO_APPROVE_MAX_AMOUNT
})

describe("BackofficeSubscriptionChangeOrderUseCase.create — G1", () => {
  it("teto default é 0 — qualquer preço avulso exige aprovação de manager", () => {
    expect(SUBSCRIPTION_CHANGE_ORDER_OVERRIDE_AUTO_APPROVE_MAX_AMOUNT).toBe(0)
  })

  it("sem preço avulso → chargeAmount = pró-rata do servidor, overrideStatus not_required", async () => {
    const repository = makeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: null,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
    })

    expect(output.isValid).toBe(true)
    const result = output.result as any
    expect(result.chargeAmount).toBe(100)
    expect(result.proratedAmount).toBe(100)
    expect(result.overrideStatus).toBe("not_required")
  })

  it("T-50.15: preço avulso acima do teto (0) → ordem nasce pending de aprovação", async () => {
    const repository = makeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: 150,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
    })

    expect(output.isValid).toBe(true)
    const result = output.result as any
    expect(result.overrideStatus).toBe("pending")
    expect(result.chargeAmount).toBe(150)
    expect(output.successMessages[0]).toMatch(/aguardando aprovação/i)
  })

  it("preço avulso igual à pró-rata (delta 0) → auto-aprova mesmo com teto 0", async () => {
    const repository = makeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: 100,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
    })

    const result = output.result as any
    expect(result.overrideStatus).toBe("approved")
    expect(result.chargeAmount).toBe(100)
  })

  it("T-50.17: pró-rata é sempre calculada no servidor — payload não tem como injetar um valor diferente", async () => {
    const repository = makeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: null,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
      // @ts-expect-error — proratedAmount não existe no input; se algum dia existir, este teste falha e avisa
      proratedAmount: 1,
    })

    const result = output.result as any
    expect(result.proratedAmount).toBe(100)
  })

  it("master com hasPermanentSubscription → rejeitado", async () => {
    const repository = makeRepository({
      findMasterContext: mock(async () => ({
        hasPermanentSubscription: true,
        currentProductId: null,
        currentCycle: null,
        currentChargedAmount: null,
        currentPeriodEnd: null,
      })),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: null,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
    })

    expect(output.isValid).toBe(false)
  })

  it("produto alvo inativo → rejeitado, create não é chamado", async () => {
    const repository = makeRepository({
      findTargetProduct: mock(async () => ({
        id: PRODUCT_ID,
        name: "CRM",
        isActive: false,
        priceMonthly: 100,
        priceQuarterly: null,
        priceQuadrimester: null,
        priceSemiannual: null,
        priceAnnual: null,
      })),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: null,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
    })

    expect(output.isValid).toBe(false)
    expect(repository.create).not.toHaveBeenCalled()
  })
})

describe("BackofficeSubscriptionChangeOrderUseCase.approveOverride — G1", () => {
  it("ordem sem preço avulso pendente → rejeitado", async () => {
    const repository = makeRepository({
      findById: mock(async () => ({
        id: "order-1",
        masterProfileId: MASTER_ID,
        status: "draft",
        targetProductId: PRODUCT_ID,
        targetCycle: "monthly",
        listAmount: 100,
        proratedAmount: 100,
        overrideAmount: null,
        overrideStatus: "not_required",
        overrideApprovedByProfileId: null,
        chargeAmount: 100,
        createdAt: new Date(),
      })),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.approveOverride("order-1", ACTOR_PROFILE_ID)

    expect(output.isValid).toBe(false)
    expect(repository.approveOverride).not.toHaveBeenCalled()
  })

  it("ordem com preço avulso pendente → aprova", async () => {
    const repository = makeRepository({
      findById: mock(async () => ({
        id: "order-1",
        masterProfileId: MASTER_ID,
        status: "draft",
        targetProductId: PRODUCT_ID,
        targetCycle: "monthly",
        listAmount: 100,
        proratedAmount: 100,
        overrideAmount: 150,
        overrideStatus: "pending",
        overrideApprovedByProfileId: null,
        chargeAmount: 150,
        createdAt: new Date(),
      })),
      approveOverride: mock(async () => ({
        id: "order-1",
        masterProfileId: MASTER_ID,
        status: "draft",
        targetProductId: PRODUCT_ID,
        targetCycle: "monthly",
        listAmount: 100,
        proratedAmount: 100,
        overrideAmount: 150,
        overrideStatus: "approved",
        overrideApprovedByProfileId: ACTOR_PROFILE_ID,
        chargeAmount: 150,
        createdAt: new Date(),
      })),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.approveOverride("order-1", ACTOR_PROFILE_ID)

    expect(output.isValid).toBe(true)
    expect(repository.approveOverride).toHaveBeenCalledWith("order-1", ACTOR_PROFILE_ID)
  })

  it("ordem não encontrada → rejeitado", async () => {
    const repository = makeRepository({ findById: mock(async () => null) })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.approveOverride("missing", ACTOR_PROFILE_ID)

    expect(output.isValid).toBe(false)
  })
})

function makeDraftOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "order-1",
    masterProfileId: MASTER_ID,
    status: "draft",
    targetProductId: PRODUCT_ID,
    targetProductName: "CRM",
    targetCycle: "monthly",
    listAmount: 100,
    proratedAmount: 100,
    overrideAmount: null,
    overrideStatus: "not_required",
    overrideApprovedByProfileId: null,
    chargeAmount: 100,
    asaasPaymentId: null,
    asaasAccount: "primary",
    paymentInvoiceUrl: null,
    createdAt: new Date(),
    ...overrides,
  }
}

describe("BackofficeSubscriptionChangeOrderUseCase.generatePayment — G2", () => {
  function makeAsaasClient(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      endpoints: { customers: "https://asaas.test/customers", payments: "https://asaas.test/payments" },
      request: mock(async (endpoint: string) => {
        if (endpoint.includes("/payments")) {
          return { id: "pay_new_1", invoiceUrl: "https://asaas.test/i/pay_new_1", status: "PENDING" }
        }
        return { id: "cus_1" }
      }),
      ...overrides,
    }
  }

  function makeDeps(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      asaasClientFactory: mock(() => makeAsaasClient()),
      asaasCustomerGateway: { createCustomer: mock(async () => ({ id: "cus_new_1" })) },
      emailService: { sendSubscriptionChangeOrderPaymentEmail: mock(async () => {}) },
      ...overrides,
    }
  }

  it("master sem customer Asaas → cria customer na conta primary e persiste", async () => {
    const repository = makeRepository({ findById: mock(async () => makeDraftOrder()) })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    const output = await useCase.generatePayment("order-1")

    expect(output.isValid).toBe(true)
    expect(deps.asaasCustomerGateway.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: MASTER_ID })
    )
    expect(repository.updateMasterAsaasCustomer).toHaveBeenCalledWith(MASTER_ID, "cus_new_1")
  })

  it("master já tem customer na conta primary → reusa, não cria outro", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeDraftOrder()),
      findMasterContext: mock(async () => ({
        hasPermanentSubscription: false,
        currentProductId: null,
        currentCycle: null,
        currentChargedAmount: null,
        currentPeriodEnd: null,
        billingProfile: makeBillingProfile({ asaasCustomerId: "cus_existing", asaasCustomerAccount: "primary" }),
      })),
    })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    await useCase.generatePayment("order-1")

    expect(deps.asaasCustomerGateway.createCustomer).not.toHaveBeenCalled()
    expect(repository.updateMasterAsaasCustomer).not.toHaveBeenCalled()
  })

  it("master com customer só na conta legacy → cria um novo na primary (DA6: nunca cobra na legada)", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeDraftOrder()),
      findMasterContext: mock(async () => ({
        hasPermanentSubscription: false,
        currentProductId: null,
        currentCycle: null,
        currentChargedAmount: null,
        currentPeriodEnd: null,
        billingProfile: makeBillingProfile({ asaasCustomerId: "cus_legacy", asaasCustomerAccount: "legacy" }),
      })),
    })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    await useCase.generatePayment("order-1")

    expect(deps.asaasCustomerGateway.createCustomer).toHaveBeenCalled()
  })

  it("cria a cobrança na conta primary, anexa ao pedido e envia e-mail nosso (nunca notificação do Asaas)", async () => {
    const repository = makeRepository({ findById: mock(async () => makeDraftOrder()) })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    const output = await useCase.generatePayment("order-1")

    expect(output.isValid).toBe(true)
    expect(deps.asaasClientFactory).toHaveBeenCalledWith("primary")
    expect(repository.attachPayment).toHaveBeenCalledWith(
      "order-1",
      expect.objectContaining({
        asaasPaymentId: "pay_new_1",
        asaasAccount: "primary",
        paymentInvoiceUrl: "https://asaas.test/i/pay_new_1",
      })
    )
    expect(deps.emailService.sendSubscriptionChangeOrderPaymentEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        masterEmail: "master@example.com",
        invoiceUrl: "https://asaas.test/i/pay_new_1",
        chargeAmount: 100,
      })
    )
  })

  it("ordem com preço avulso pendente → rejeitado, nenhuma cobrança é gerada", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeDraftOrder({ overrideStatus: "pending" })),
    })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    const output = await useCase.generatePayment("order-1")

    expect(output.isValid).toBe(false)
    expect(deps.asaasClientFactory).not.toHaveBeenCalled()
    expect(repository.attachPayment).not.toHaveBeenCalled()
  })

  it("ordem que não está em draft (já awaiting_payment) → rejeitado, idempotente", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeDraftOrder({ status: "awaiting_payment" })),
    })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    const output = await useCase.generatePayment("order-1")

    expect(output.isValid).toBe(false)
    expect(repository.attachPayment).not.toHaveBeenCalled()
  })

  it("ordem não encontrada → rejeitado", async () => {
    const repository = makeRepository({ findById: mock(async () => null) })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    const output = await useCase.generatePayment("missing")

    expect(output.isValid).toBe(false)
  })
})
