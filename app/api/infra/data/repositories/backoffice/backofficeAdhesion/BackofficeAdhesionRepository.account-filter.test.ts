import { beforeEach, describe, expect, it, mock } from "bun:test"

const findFirstMock = mock(async () => null as unknown)
const findUniqueMock = mock(async () => null as unknown)
const queryRawMock = mock(async () => [] as Array<{ id: string }>)
const createMock = mock(async (_args: { data: Record<string, unknown> }) => ({}) as unknown)
const leadUpdateMock = mock(async () => ({}) as unknown)
const transactionMock = mock(async (callback: (tx: unknown) => unknown) =>
  callback({
    backofficeAdhesion: { create: createMock },
    backofficeLead: { update: leadUpdateMock },
  })
)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficeAdhesion: {
      findFirst: findFirstMock,
      findUnique: findUniqueMock,
    },
    $queryRaw: queryRawMock,
    $transaction: transactionMock,
  },
}))

const { BackofficeAdhesionRepository } = await import("./BackofficeAdhesionRepository")

describe("BackofficeAdhesionRepository — filtro por conta (E4/C33)", () => {
  beforeEach(() => {
    findFirstMock.mockClear()
    findUniqueMock.mockClear()
    queryRawMock.mockClear()
    createMock.mockClear()
    leadUpdateMock.mockClear()
    findFirstMock.mockImplementation(async () => null)
    findUniqueMock.mockImplementation(async () => null)
    queryRawMock.mockImplementation(async () => [])
    createMock.mockImplementation(async () => ({}))
    leadUpdateMock.mockImplementation(async () => ({}))
  })

  it("createAndMoveLeadToAdhesion grava asaasAccount: 'primary' — sem isso o webhook nunca encontra a adesão", async () => {
    const repo = new BackofficeAdhesionRepository()

    await repo.createAndMoveLeadToAdhesion({
      leadId: "lead-1",
      fullName: "Fulano de Tal",
      phone: "11999999999",
      plan: "crm",
      cycle: "monthly",
      modules: [],
      extraTeams: 0,
      extraUsers: 0,
      monthlyBaseAmount: 100,
      monthlyExtraTeamsAmount: 0,
      monthlyExtraUsersAmount: 0,
      monthlyTotalAmount: 100,
      totalAmount: 100,
      tokenHash: "hash",
      tokenPreview: "preview",
      expiresAt: new Date(),
    } as any)

    expect(createMock).toHaveBeenCalledTimes(1)
    const call = createMock.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data.asaasAccount).toBe("primary")
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
