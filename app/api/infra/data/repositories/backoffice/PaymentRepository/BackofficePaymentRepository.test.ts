import { beforeEach, describe, expect, it, mock } from "bun:test"

const findFirstMock = mock(async () => null as unknown)
const createMock = mock(async (_args: { data: Record<string, unknown> }) => ({}) as unknown)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficePayment: {
      findFirst: findFirstMock,
      create: createMock,
    },
  },
}))

const { BackofficePaymentRepository } = await import("./BackofficePaymentRepository")

describe("BackofficePaymentRepository.findByAsaasPaymentId — filtro por conta (E4/C33)", () => {
  beforeEach(() => {
    findFirstMock.mockClear()
    findFirstMock.mockImplementation(async () => null)
  })

  it("filtra por asaasPaymentId E asaasAccount juntos, não só o id", async () => {
    const repo = new BackofficePaymentRepository()

    await repo.findByAsaasPaymentId("pay_123", "primary")

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { asaasPaymentId: "pay_123", asaasAccount: "primary" },
    })
  })

  it("mesmo asaasPaymentId, conta diferente → where diferente (base do teste de colisão T-10.12)", async () => {
    const repo = new BackofficePaymentRepository()

    await repo.findByAsaasPaymentId("pay_123", "legacy")

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { asaasPaymentId: "pay_123", asaasAccount: "legacy" },
    })
  })
})

describe("BackofficePaymentRepository.create — toda cobrança nova nasce na conta primary (C33)", () => {
  beforeEach(() => {
    createMock.mockClear()
    createMock.mockImplementation(async () => ({}))
  })

  it("grava asaasAccount: 'primary' — sem isso o webhook (que filtra por conta) nunca encontra o pagamento", async () => {
    const repo = new BackofficePaymentRepository()

    await repo.create({
      id: "payment-1",
      clientId: "client-1",
      amount: 100,
      asaasPaymentId: "pay_new_1",
    })

    expect(createMock).toHaveBeenCalledTimes(1)
    const call = createMock.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data.asaasAccount).toBe("primary")
  })
})
