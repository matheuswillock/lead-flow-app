import { beforeEach, describe, expect, it, mock } from "bun:test"

const findFirstMock = mock(async () => null as any)
const changeOrderUpdateManyMock = mock(async () => ({ count: 1 }))
const changeOrderFindUniqueOrThrowMock = mock(async () => null as any)
const profileSubscriptionFindUniqueMock = mock(async () => null as any)
const profileSubscriptionUpsertMock = mock(async () => ({}) as any)

const txStub = {
  backofficeSubscriptionChangeOrder: {
    updateMany: changeOrderUpdateManyMock,
    findUniqueOrThrow: changeOrderFindUniqueOrThrowMock,
  },
  profileSubscription: {
    findUnique: profileSubscriptionFindUniqueMock,
    upsert: profileSubscriptionUpsertMock,
  },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findFirst: findFirstMock },
    $transaction: mock(async (fn: (tx: typeof txStub) => Promise<unknown>) => fn(txStub)),
  },
}))

const { BackofficeSubscriptionChangeOrderRepository } = await import(
  "./BackofficeSubscriptionChangeOrderRepository"
)

beforeEach(() => {
  changeOrderUpdateManyMock.mockClear()
  changeOrderFindUniqueOrThrowMock.mockClear()
  profileSubscriptionFindUniqueMock.mockClear()
  profileSubscriptionUpsertMock.mockClear()
})

const MASTER_ID = "11111111-1111-4111-8111-111111111111"

function makeMaster(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MASTER_ID,
    fullName: "Master Teste",
    email: "master@example.com",
    cpfCnpj: null,
    phone: null,
    postalCode: null,
    address: null,
    addressNumber: null,
    neighborhood: null,
    complement: null,
    asaasCustomerId: null,
    asaasCustomerAccount: "primary",
    hasPermanentSubscription: false,
    subscription: null,
    ...overrides,
  }
}

describe("BackofficeSubscriptionChangeOrderRepository.findMasterContext — achado codex/cursor[bot] no PR #1167", () => {
  it("com adesão vinculada → currentChargedAmount vem do valor negociado/gravado da adesão (regressão)", async () => {
    findFirstMock.mockResolvedValueOnce(
      makeMaster({
        subscription: {
          productId: "product-1",
          subscriptionCycle: "MONTHLY",
          subscriptionNextDueDate: new Date(),
          adhesion: { cycle: "monthly", totalAmount: "100", negotiatedTotalAmount: "79.90" },
          product: {
            priceMonthly: "100",
            priceQuarterly: null,
            priceQuadrimester: null,
            priceSemiannual: null,
            priceAnnual: null,
          },
        },
      }) as any
    )

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    const context = await repository.findMasterContext(MASTER_ID)

    expect(context?.currentChargedAmount).toBe(79.9)
  })

  it("legado sem adesão (ciclo + vencimento, produto vinculado) → cai para o preço de tabela do produto atual, nunca null/0", async () => {
    findFirstMock.mockResolvedValueOnce(
      makeMaster({
        subscription: {
          productId: "product-1",
          subscriptionCycle: "QUARTERLY",
          subscriptionNextDueDate: new Date(),
          adhesion: null,
          product: {
            priceMonthly: "79.90",
            priceQuarterly: "219.90",
            priceQuadrimester: null,
            priceSemiannual: null,
            priceAnnual: null,
          },
        },
      }) as any
    )

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    const context = await repository.findMasterContext(MASTER_ID)

    expect(context?.currentCycle).toBe("quarterly")
    expect(context?.currentChargedAmount).toBe(219.9)
  })

  it("pós-G3 (adhesionId zerado pela aplicação anterior, produto+ciclo já são os novos) → mesma fallback, nunca credita zero numa 2ª alteração", async () => {
    findFirstMock.mockResolvedValueOnce(
      makeMaster({
        subscription: {
          productId: "product-2",
          subscriptionCycle: "YEARLY",
          subscriptionNextDueDate: new Date(),
          adhesion: null,
          product: {
            priceMonthly: null,
            priceQuarterly: null,
            priceQuadrimester: null,
            priceSemiannual: null,
            priceAnnual: "958.80",
          },
        },
      }) as any
    )

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    const context = await repository.findMasterContext(MASTER_ID)

    expect(context?.currentChargedAmount).toBe(958.8)
  })

  it("sem assinatura nenhuma → currentChargedAmount null (não há o que abater)", async () => {
    findFirstMock.mockResolvedValueOnce(makeMaster({ subscription: null }) as any)

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    const context = await repository.findMasterContext(MASTER_ID)

    expect(context?.currentChargedAmount).toBeNull()
  })
})

function makeChangeOrderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "order-1",
    masterProfileId: MASTER_ID,
    status: "applied",
    targetProductId: "product-1",
    targetProduct: { name: "CRM" },
    targetCycle: "monthly",
    listAmount: { toString: () => "100" },
    proratedAmount: { toString: () => "100" },
    overrideAmount: null,
    overrideStatus: "not_required",
    overrideApprovedByProfileId: null,
    chargeAmount: { toString: () => "100" },
    asaasPaymentId: "pay_1",
    asaasAccount: "primary",
    paymentInvoiceUrl: null,
    createdAt: new Date(),
    ...overrides,
  }
}

describe("BackofficeSubscriptionChangeOrderRepository.applyChangeOrder — achado cursor[bot] no PR #1167 (rodada 2)", () => {
  it("master suspended enquanto a ordem aguardava pagamento → NÃO promove subscriptionStatus para active", async () => {
    changeOrderUpdateManyMock.mockResolvedValueOnce({ count: 1 })
    changeOrderFindUniqueOrThrowMock.mockResolvedValueOnce(makeChangeOrderRow() as any)
    profileSubscriptionFindUniqueMock.mockResolvedValueOnce({ subscriptionStatus: "suspended" } as any)

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    const result = await repository.applyChangeOrder("order-1")

    expect(result).not.toBeNull()
    expect(profileSubscriptionUpsertMock).toHaveBeenCalledTimes(1)
    const calls = profileSubscriptionUpsertMock.mock.calls as unknown as Array<
      [{ update?: Record<string, unknown> }]
    >
    const call = calls[0]?.[0]
    expect(call?.update).not.toHaveProperty("subscriptionStatus")
    expect(call?.update).toMatchObject({ productId: "product-1", adhesionId: null })
  })

  it("master past_due enquanto a ordem aguardava pagamento → NÃO promove subscriptionStatus para active", async () => {
    changeOrderUpdateManyMock.mockResolvedValueOnce({ count: 1 })
    changeOrderFindUniqueOrThrowMock.mockResolvedValueOnce(makeChangeOrderRow() as any)
    profileSubscriptionFindUniqueMock.mockResolvedValueOnce({ subscriptionStatus: "past_due" } as any)

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    await repository.applyChangeOrder("order-1")

    const calls = profileSubscriptionUpsertMock.mock.calls as unknown as Array<
      [{ update?: Record<string, unknown> }]
    >
    const call = calls[0]?.[0]
    expect(call?.update).not.toHaveProperty("subscriptionStatus")
  })

  it("master sem ProfileSubscription prévia (primeira ativação) → promove para active normalmente", async () => {
    changeOrderUpdateManyMock.mockResolvedValueOnce({ count: 1 })
    changeOrderFindUniqueOrThrowMock.mockResolvedValueOnce(makeChangeOrderRow() as any)
    profileSubscriptionFindUniqueMock.mockResolvedValueOnce(null as any)

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    await repository.applyChangeOrder("order-1")

    const calls = profileSubscriptionUpsertMock.mock.calls as unknown as Array<
      [{ update?: Record<string, unknown> }]
    >
    const call = calls[0]?.[0]
    expect(call?.update).toMatchObject({ subscriptionStatus: "active" })
  })

  it("master active → promove para active normalmente (comportamento pré-existente preservado)", async () => {
    changeOrderUpdateManyMock.mockResolvedValueOnce({ count: 1 })
    changeOrderFindUniqueOrThrowMock.mockResolvedValueOnce(makeChangeOrderRow() as any)
    profileSubscriptionFindUniqueMock.mockResolvedValueOnce({ subscriptionStatus: "active" } as any)

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    await repository.applyChangeOrder("order-1")

    const calls = profileSubscriptionUpsertMock.mock.calls as unknown as Array<
      [{ update?: Record<string, unknown> }]
    >
    const call = calls[0]?.[0]
    expect(call?.update).toMatchObject({ subscriptionStatus: "active" })
  })
})

describe("BackofficeSubscriptionChangeOrderRepository.applyFreeChangeOrder — achado cursor[bot] no PR #1167 (rodada 2)", () => {
  it("chargeAmount 0 em draft → aplica direto (mesma trava de concorrência de applyChangeOrder, partindo de draft)", async () => {
    changeOrderUpdateManyMock.mockResolvedValueOnce({ count: 1 })
    changeOrderFindUniqueOrThrowMock.mockResolvedValueOnce(
      makeChangeOrderRow({ chargeAmount: { toString: () => "0" } }) as any
    )
    profileSubscriptionFindUniqueMock.mockResolvedValueOnce({ subscriptionStatus: "active" } as any)

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    const result = await repository.applyFreeChangeOrder("order-1")

    expect(result).not.toBeNull()
    expect(changeOrderUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "order-1", status: "draft", chargeAmount: 0 },
      data: expect.objectContaining({ status: "applied" }),
    })
  })

  it("updateMany não casa (ordem não estava draft/chargeAmount!=0) → null, idempotente", async () => {
    changeOrderUpdateManyMock.mockResolvedValueOnce({ count: 0 })

    const repository = new BackofficeSubscriptionChangeOrderRepository()
    const result = await repository.applyFreeChangeOrder("order-1")

    expect(result).toBeNull()
    expect(profileSubscriptionUpsertMock).not.toHaveBeenCalled()
  })
})
