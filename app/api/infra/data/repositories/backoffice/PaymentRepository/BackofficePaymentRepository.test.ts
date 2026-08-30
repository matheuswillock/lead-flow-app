import { beforeEach, describe, expect, it, mock } from "bun:test"

const findFirstMock = mock(async () => null as unknown)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficePayment: {
      findFirst: findFirstMock,
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
