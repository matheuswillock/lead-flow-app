import { describe, expect, it, mock } from "bun:test"

const findFirstMock = mock(async () => null as any)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findFirst: findFirstMock },
  },
}))

const { BackofficeSubscriptionChangeOrderRepository } = await import(
  "./BackofficeSubscriptionChangeOrderRepository"
)

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
