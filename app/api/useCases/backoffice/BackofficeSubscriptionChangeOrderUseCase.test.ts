import { beforeEach, describe, expect, it, mock } from "bun:test"
import {
  BackofficeSubscriptionChangeOrderUseCase,
  SUBSCRIPTION_CHANGE_ORDER_OVERRIDE_AUTO_APPROVE_MAX_AMOUNT,
} from "./BackofficeSubscriptionChangeOrderUseCase"

mock.module("server-only", () => ({}))

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
      currentSubscriptionStatus: "active",
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
    applyChangeOrder: mock(async (id: string) => ({
      id,
      masterProfileId: MASTER_ID,
      status: "applied",
      targetProductId: PRODUCT_ID,
      targetProductName: "CRM",
      targetCycle: "monthly",
      listAmount: 100,
      proratedAmount: 100,
      overrideAmount: null,
      overrideStatus: "not_required",
      overrideApprovedByProfileId: null,
      chargeAmount: 100,
      asaasPaymentId: "pay_new_1",
      asaasAccount: "primary",
      paymentInvoiceUrl: "https://asaas.test/i/pay_new_1",
      createdAt: new Date(),
    })),
    applyFreeChangeOrder: mock(async (id: string) => ({
      id,
      masterProfileId: MASTER_ID,
      status: "applied",
      targetProductId: PRODUCT_ID,
      targetProductName: "CRM",
      targetCycle: "monthly",
      listAmount: 100,
      proratedAmount: 0,
      overrideAmount: null,
      overrideStatus: "not_required",
      overrideApprovedByProfileId: null,
      chargeAmount: 0,
      asaasPaymentId: null,
      asaasAccount: "primary",
      paymentInvoiceUrl: null,
      createdAt: new Date(),
    })),
    logEvent: mock(async () => {}),
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

  it("G4: create() é um passo administrativo, não lifecycle — nunca grava eventType tipado", async () => {
    const repository = makeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: null,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
    })

    expect(repository.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "subscription_change_order_created" })
    )
    const calls = repository.logEvent.mock.calls as unknown as Array<[{ eventType?: unknown }]>
    expect(calls[0]?.[0]?.eventType).toBeUndefined()
  })

  it("T-50.15: preço avulso acima do teto (0) → ordem nasce pending de aprovação, chargeAmount continua a pró-rata (achado cursor[bot]/codex no PR #1167)", async () => {
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
    // Contrato do model: chargeAmount é sempre proratedAmount a menos que
    // overrideAmount esteja APROVADO — nunca o valor avulso não aprovado.
    expect(result.chargeAmount).toBe(100)
    expect(result.overrideAmount).toBe(150)
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

  it.each(["suspended", "past_due", "canceled"])(
    "master com assinatura %s → rejeitado, create não é chamado (achado cursor[bot] no PR #1167, rodada 2)",
    async (status) => {
      const repository = makeRepository({
        findMasterContext: mock(async () => ({
          hasPermanentSubscription: false,
          currentProductId: PRODUCT_ID,
          currentCycle: "monthly",
          currentChargedAmount: 100,
          currentSubscriptionStatus: status,
          currentPeriodEnd: null,
          billingProfile: makeBillingProfile(),
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
    }
  )

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

  it("ordem com preço avulso pendente → aprova e PROMOVE chargeAmount para o avulso (achado cursor[bot]/codex no PR #1167)", async () => {
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
        // enquanto pending, chargeAmount é a pró-rata — nunca o avulso não aprovado.
        chargeAmount: 100,
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
        // só agora, aprovado, chargeAmount é promovido para o avulso.
        chargeAmount: 150,
        createdAt: new Date(),
      })),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.approveOverride("order-1", ACTOR_PROFILE_ID)

    expect(output.isValid).toBe(true)
    expect(repository.approveOverride).toHaveBeenCalledWith("order-1", ACTOR_PROFILE_ID)
    const result = output.result as any
    expect(result.chargeAmount).toBe(150)
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

  it("master suspenso enquanto a ordem aguardava (defesa em profundidade) → rejeitado, nenhuma cobrança é gerada", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeDraftOrder()),
      findMasterContext: mock(async () => ({
        hasPermanentSubscription: false,
        currentProductId: null,
        currentCycle: null,
        currentChargedAmount: null,
        currentSubscriptionStatus: "suspended",
        currentPeriodEnd: null,
        billingProfile: makeBillingProfile(),
      })),
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

  it("chargeAmount 0 (downgrade/sem diferença) → aplica direto, sem Asaas (achado cursor[bot] no PR #1167, rodada 2)", async () => {
    const repository = makeRepository({ findById: mock(async () => makeDraftOrder({ chargeAmount: 0 })) })
    const deps = makeDeps()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(
      repository as any,
      deps.asaasClientFactory as any,
      deps.asaasCustomerGateway as any,
      deps.emailService as any
    )

    const output = await useCase.generatePayment("order-1")

    expect(output.isValid).toBe(true)
    expect(deps.asaasClientFactory).not.toHaveBeenCalled()
    expect(repository.attachPayment).not.toHaveBeenCalled()
    expect(repository.applyFreeChangeOrder).toHaveBeenCalledWith("order-1")
    expect(repository.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ changeType: "subscription_change_order_applied", eventType: "plan_changed" })
    )
  })

  it("chargeAmount 0 mas applyFreeChangeOrder devolve null (status inesperado) → rejeitado", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeDraftOrder({ chargeAmount: 0 })),
      applyFreeChangeOrder: mock(async () => null),
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

describe("BackofficeSubscriptionChangeOrderUseCase.applyPaidChangeOrder — G3", () => {
  function makeAwaitingPaymentOrder(overrides: Partial<Record<string, unknown>> = {}) {
    return makeDraftOrder({
      status: "awaiting_payment",
      asaasPaymentId: "pay_new_1",
      asaasAccount: "primary",
      paymentInvoiceUrl: "https://asaas.test/i/pay_new_1",
      ...overrides,
    })
  }

  it("T-50.16: evento de pagamento confirmado → aplica exatamente uma vez", async () => {
    const repository = makeRepository({ findById: mock(async () => makeAwaitingPaymentOrder()) })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })

    expect(output.isValid).toBe(true)
    expect(repository.applyChangeOrder).toHaveBeenCalledWith("order-1")
  })

  it("G4: a aplicação grava eventType 'plan_changed' na timeline tipada de SPEC 20 — a única das 4 transições que é lifecycle de verdade", async () => {
    const repository = makeRepository({ findById: mock(async () => makeAwaitingPaymentOrder()) })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })

    expect(repository.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        changeType: "subscription_change_order_applied",
        eventType: "plan_changed",
      })
    )
  })

  it("idempotência: ordem já applied → sucesso silencioso, não reaplica", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeAwaitingPaymentOrder({ status: "applied" })),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })

    expect(output.isValid).toBe(true)
    expect(repository.applyChangeOrder).not.toHaveBeenCalled()
  })

  it("idempotência sob corrida: repository.applyChangeOrder devolve null (outra instância já aplicou) → sucesso, não é erro", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeAwaitingPaymentOrder()),
      applyChangeOrder: mock(async () => null),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })

    expect(output.isValid).toBe(true)
  })

  it("ordem ainda em draft (sem cobrança gerada) → rejeitado, nunca aplica", async () => {
    const repository = makeRepository({
      findById: mock(async () => makeDraftOrder()),
    })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })

    expect(output.isValid).toBe(false)
    expect(repository.applyChangeOrder).not.toHaveBeenCalled()
  })

  it("ownership: paymentId do evento não bate com o da ordem → rejeitado, nunca aplica", async () => {
    const repository = makeRepository({ findById: mock(async () => makeAwaitingPaymentOrder()) })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_OUTRO_PAGAMENTO",
      account: "primary",
    })

    expect(output.isValid).toBe(false)
    expect(repository.applyChangeOrder).not.toHaveBeenCalled()
  })

  it("ownership: conta do evento não bate com a da ordem → rejeitado, nunca aplica", async () => {
    const repository = makeRepository({ findById: mock(async () => makeAwaitingPaymentOrder()) })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_new_1",
      account: "legacy",
    })

    expect(output.isValid).toBe(false)
    expect(repository.applyChangeOrder).not.toHaveBeenCalled()
  })

  it("externalReference que não é de uma ordem de alteração → rejeitado", async () => {
    const repository = makeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "pending-action-xyz",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })

    expect(output.isValid).toBe(false)
    expect(repository.findById).not.toHaveBeenCalled()
  })

  it("ordem não encontrada → rejeitado", async () => {
    const repository = makeRepository({ findById: mock(async () => null) })
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    const output = await useCase.applyPaidChangeOrder({
      externalReference: "subscription-change-order-missing",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })

    expect(output.isValid).toBe(false)
  })
})

describe("BackofficeSubscriptionChangeOrderUseCase.create — G3 invariante (nenhum entitlement antes do pagamento)", () => {
  it("create() nunca chama applyChangeOrder — nenhum entitlement muda antes da confirmação de pagamento", async () => {
    const repository = makeRepository()
    const useCase = new BackofficeSubscriptionChangeOrderUseCase(repository as any)

    await useCase.create({
      masterProfileId: MASTER_ID,
      targetProductId: PRODUCT_ID,
      targetCycle: "monthly",
      overrideAmount: null,
      actorProfileId: ACTOR_PROFILE_ID,
      backofficeUserId: BACKOFFICE_USER_ID,
    })

    expect(repository.applyChangeOrder).not.toHaveBeenCalled()
  })
})
