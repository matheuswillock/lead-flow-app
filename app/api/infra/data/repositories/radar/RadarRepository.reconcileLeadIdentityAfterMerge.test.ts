import { beforeEach, describe, expect, it, mock } from "bun:test"

const TEAM_ID = "team-1"
const SOURCE_LEAD_ID = "source-lead-1"
const TARGET_LEAD_ID = "target-lead-1"

const findUniqueMock = mock(
  async (_args: {
    where: { teamId_type_normalizedValue: { teamId: string; type: string; normalizedValue: string } }
  }) => null as { id: string } | null
)
const updateMock = mock(async () => ({}))
const deleteMock = mock(async () => ({}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    radarIdentity: {
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
  withPrismaRetry: async <T>(fn: () => Promise<T>) => fn(),
}))

const { RadarRepository } = await import("./RadarRepository")

describe("RadarRepository.reconcileLeadIdentityAfterMerge", () => {
  beforeEach(() => {
    findUniqueMock.mockReset()
    updateMock.mockClear()
    deleteMock.mockClear()
  })

  it("não faz nada quando nenhum perfil tem identidade lead_id para o lead de origem", async () => {
    findUniqueMock.mockResolvedValueOnce(null)

    const repo = new RadarRepository()
    await repo.reconcileLeadIdentityAfterMerge(TEAM_ID, SOURCE_LEAD_ID, TARGET_LEAD_ID)

    expect(updateMock).not.toHaveBeenCalled()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("reaponta o valor da identidade para o lead alvo quando ninguém está vinculado a ele ainda", async () => {
    findUniqueMock
      .mockResolvedValueOnce({ id: "identity-source" })
      .mockResolvedValueOnce(null)

    const repo = new RadarRepository()
    await repo.reconcileLeadIdentityAfterMerge(TEAM_ID, SOURCE_LEAD_ID, TARGET_LEAD_ID)

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "identity-source" },
      data: { normalizedValue: TARGET_LEAD_ID },
    })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("remove a identidade de origem, sem duplicar o vínculo, quando o alvo já tem identidade lead_id", async () => {
    findUniqueMock
      .mockResolvedValueOnce({ id: "identity-source" })
      .mockResolvedValueOnce({ id: "identity-target" })

    const repo = new RadarRepository()
    await repo.reconcileLeadIdentityAfterMerge(TEAM_ID, SOURCE_LEAD_ID, TARGET_LEAD_ID)

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "identity-source" } })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
