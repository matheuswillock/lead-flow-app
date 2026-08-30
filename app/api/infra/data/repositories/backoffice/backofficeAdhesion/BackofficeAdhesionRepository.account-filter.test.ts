import { beforeEach, describe, expect, it, mock } from "bun:test"

const findFirstMock = mock(async () => null as unknown)
const findUniqueMock = mock(async () => null as unknown)
const queryRawMock = mock(async () => [] as Array<{ id: string }>)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficeAdhesion: {
      findFirst: findFirstMock,
      findUnique: findUniqueMock,
    },
    $queryRaw: queryRawMock,
  },
}))

const { BackofficeAdhesionRepository } = await import("./BackofficeAdhesionRepository")

describe("BackofficeAdhesionRepository — filtro por conta (E4/C33)", () => {
  beforeEach(() => {
    findFirstMock.mockClear()
    findUniqueMock.mockClear()
    queryRawMock.mockClear()
    findFirstMock.mockImplementation(async () => null)
    findUniqueMock.mockImplementation(async () => null)
    queryRawMock.mockImplementation(async () => [])
  })

  it("findByAsaasPaymentId filtra por asaasPaymentId E asaasAccount juntos", async () => {
    const repo = new BackofficeAdhesionRepository()

    await repo.findByAsaasPaymentId("pay_123", "primary")

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { asaasPaymentId: "pay_123", asaasAccount: "primary" },
      })
    )
  })

  it("findByAsaasPaymentId — mesmo id, conta diferente → where diferente (base do T-10.12)", async () => {
    const repo = new BackofficeAdhesionRepository()

    await repo.findByAsaasPaymentId("pay_123", "legacy")

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { asaasPaymentId: "pay_123", asaasAccount: "legacy" },
      })
    )
  })

  it("findByLedgerAsaasPaymentId inclui o filtro de asaasAccount no SQL raw", async () => {
    const repo = new BackofficeAdhesionRepository()

    await repo.findByLedgerAsaasPaymentId("pay_456", "legacy")

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const call = queryRawMock.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]]
    const sqlText = call[0].join(" ? ")
    expect(sqlText).toContain('"asaasAccount"')
    expect(sqlText).toContain('"asaas_account"')
    expect(call).toContain("legacy")
  })

  it("findByLedgerAsaasPaymentId sem match no ledger → null, sem chamar findById", async () => {
    queryRawMock.mockImplementation(async () => [])

    const repo = new BackofficeAdhesionRepository()
    const result = await repo.findByLedgerAsaasPaymentId("pay_missing", "primary")

    expect(result).toBeNull()
    expect(findUniqueMock).not.toHaveBeenCalled()
  })
})
