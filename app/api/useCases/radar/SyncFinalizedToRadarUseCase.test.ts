import { describe, expect, it, mock, beforeEach } from "bun:test"

const mockUpsertProfileForDocument = mock(async () => ({ profileId: "profile-1", created: true }))
const mockAppendEventIfNew = mock(async () => null)

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    upsertProfileForDocument: mockUpsertProfileForDocument,
    appendEventIfNew: mockAppendEventIfNew,
  },
}))

const FINALIZED_ID = "fin-abc-123"
const TEAM_ID = "team-xyz"
const CTX = { profileId: "system", teamMember: { role: "system", functions: [] } }

const makeFinalizedWithHolder = (holderDoc: string, deps: Array<{ name: string; document: string | null }> = []) => ({
  id: FINALIZED_ID,
  holder: {
    name: "João Silva",
    document: holderDoc,
    createdAt: new Date("2026-01-15T10:00:00Z"),
  },
  dependents: deps.map((d, i) => ({
    name: d.name,
    document: d.document,
    createdAt: new Date(`2026-01-15T10:0${i}:00Z`),
  })),
})

const mockPrismaFindUnique = mock(async () => makeFinalizedWithHolder("12345678901"))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    leadFinalized: {
      findUnique: mockPrismaFindUnique,
    },
  },
}))

const { syncFinalizedToRadarUseCase } = await import("@/app/api/useCases/radar/SyncFinalizedToRadarUseCase")

describe("SyncFinalizedToRadarUseCase — titular com documento", () => {
  beforeEach(() => {
    mockUpsertProfileForDocument.mockReset()
    mockAppendEventIfNew.mockReset()
    mockUpsertProfileForDocument.mockResolvedValue({ profileId: "profile-holder", created: true })
    mockAppendEventIfNew.mockResolvedValue(null)
    mockPrismaFindUnique.mockResolvedValue(makeFinalizedWithHolder("12345678901"))
  })

  it("cria perfil contract_holder para titular com documento", async () => {
    const output = await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    expect(output.isValid).toBe(true)
    expect(mockUpsertProfileForDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: TEAM_ID,
        identityType: "contract_holder",
        normalizedDocument: "12345678901",
        displayName: "João Silva",
      })
    )
  })

  it("grava evento profile.contract_linked para titular", async () => {
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    expect(mockAppendEventIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "profile-holder",
        teamId: TEAM_ID,
        eventType: "profile.contract_linked",
        sourceId: `${FINALIZED_ID}::holder`,
      })
    )
  })
})

describe("SyncFinalizedToRadarUseCase — titular sem documento (ex: contrato corporativo)", () => {
  beforeEach(() => {
    mockUpsertProfileForDocument.mockReset()
    mockAppendEventIfNew.mockReset()
    mockPrismaFindUnique.mockResolvedValue(makeFinalizedWithHolder(""))
  })

  it("não cria perfil quando document do titular está vazio", async () => {
    const output = await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    expect(output.isValid).toBe(true)
    expect(mockUpsertProfileForDocument).not.toHaveBeenCalled()
    expect(mockAppendEventIfNew).not.toHaveBeenCalled()
  })
})

describe("SyncFinalizedToRadarUseCase — dependente com documento", () => {
  beforeEach(() => {
    mockUpsertProfileForDocument.mockReset()
    mockAppendEventIfNew.mockReset()
    mockUpsertProfileForDocument.mockImplementation(
      async (...args: unknown[]) => ({
        profileId: (args[0] as { identityType: string }).identityType === "contract_holder" ? "profile-holder" : "profile-dep",
        created: true,
      }) as { profileId: string; created: boolean }
    )
    mockAppendEventIfNew.mockResolvedValue(null)
    mockPrismaFindUnique.mockResolvedValue(
      makeFinalizedWithHolder("12345678901", [{ name: "Maria Silva", document: "98765432100" }])
    )
  })

  it("cria perfil contract_dependent para dependente com documento", async () => {
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    expect(mockUpsertProfileForDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: TEAM_ID,
        identityType: "contract_dependent",
        normalizedDocument: "98765432100",
        displayName: "Maria Silva",
      })
    )
  })

  it("grava evento profile.contract_linked para dependente com documento", async () => {
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    expect(mockAppendEventIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: TEAM_ID,
        eventType: "profile.contract_linked",
        sourceId: `${FINALIZED_ID}::dep::0`,
        metadata: expect.objectContaining({ role: "dependent", index: 0 }),
      })
    )
  })
})

describe("SyncFinalizedToRadarUseCase — dependente SEM documento", () => {
  beforeEach(() => {
    mockUpsertProfileForDocument.mockReset()
    mockAppendEventIfNew.mockReset()
    mockUpsertProfileForDocument.mockImplementation(
      async (...args: unknown[]) => ({
        profileId: (args[0] as { identityType: string }).identityType === "contract_holder" ? "profile-holder" : "profile-dep",
        created: true,
      }) as { profileId: string; created: boolean }
    )
    mockAppendEventIfNew.mockResolvedValue(null)
    mockPrismaFindUnique.mockResolvedValue(
      makeFinalizedWithHolder("12345678901", [
        { name: "Pedro Silva", document: null },
        { name: "Ana Silva", document: "" },
      ])
    )
  })

  it("não cria perfil para dependente sem documento", async () => {
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    const calls = mockUpsertProfileForDocument.mock.calls as unknown as Array<[{ identityType: string }]>
    const depCalls = calls.filter(([input]) => input.identityType === "contract_dependent")
    expect(depCalls.length).toBe(0)
  })

  it("não grava evento para dependente sem documento", async () => {
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    const events = mockAppendEventIfNew.mock.calls as unknown as Array<[{ sourceId?: string }]>
    const depEvents = events.filter(([event]) => event.sourceId?.includes("::dep::"))
    expect(depEvents.length).toBe(0)
  })
})

describe("SyncFinalizedToRadarUseCase — reprocessamento idempotente", () => {
  beforeEach(() => {
    mockUpsertProfileForDocument.mockReset()
    mockAppendEventIfNew.mockReset()
    mockUpsertProfileForDocument.mockResolvedValue({ profileId: "profile-holder", created: false })
    mockAppendEventIfNew.mockResolvedValue(null)
    mockPrismaFindUnique.mockResolvedValue(makeFinalizedWithHolder("12345678901"))
  })

  it("reprocessar o mesmo finalizedId não duplica — upsertProfileForDocument retorna created:false", async () => {
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    expect(mockUpsertProfileForDocument.mock.calls.length).toBe(2)
    const results = mockUpsertProfileForDocument.mock.results
    for (const result of results) {
      const resolved = (await result.value) as { profileId: string; created: boolean }
      expect(resolved.created).toBe(false)
    }
  })

  it("appendEventIfNew é chamado mas retorna null (já existia) na segunda execução", async () => {
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)
    await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, FINALIZED_ID)

    expect(mockAppendEventIfNew).toHaveBeenCalledTimes(2)
    for (const result of mockAppendEventIfNew.mock.results) {
      const resolved = await result.value
      expect(resolved).toBeNull()
    }
  })
})

describe("SyncFinalizedToRadarUseCase — finalizedId não encontrado", () => {
  beforeEach(() => {
    mockUpsertProfileForDocument.mockReset()
    mockAppendEventIfNew.mockReset()
    mockPrismaFindUnique.mockResolvedValue(null as unknown as Parameters<typeof mockPrismaFindUnique.mockResolvedValue>[0])
  })

  it("retorna Output inválido quando finalized não existe", async () => {
    const output = await syncFinalizedToRadarUseCase.execute(TEAM_ID, CTX, "nao-existe")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.length).toBeGreaterThan(0)
  })
})
