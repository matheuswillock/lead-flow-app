import { beforeEach, describe, expect, it, mock } from "bun:test"
import { registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

const resolveProfileForDocument = mock(
  async (_input: {
    identityType: string
    normalizedDocument: string
  }) => ({
    profile: { id: "profile-1" },
    wasExisting: false,
  })
)
const upsertIdentity = mock(async () => ({}))
const upsertSourceLink = mock(async () => ({}))
const appendEventIfNew = mock(async () => ({}))
const findFinalizedForRadarSync = mock(async () => [] as unknown[])
const findSourceLinkBySource = mock(async (): Promise<{ id: string; profileId: string } | null> => null)
const deleteSourceLinkById = mock(async () => undefined)
const removeObsoleteContractIdentity = mock(async () => ({ removed: 0 }))
const deleteOrphanRadarProfileIfEmpty = mock(async () => ({ deleted: false }))

// Repositório fake entra por injeção de dependência (construtor do
// RadarService e do UseCase), não por `mock.module` do módulo RadarRepository:
// os singletons `radarService`/`syncFinalizedToRadarUseCase` podem já ter sido
// materializados por outro arquivo do processo com o repositório REAL — mock
// de módulo registrado depois não alcança dependência capturada em construtor.
registerPrismaModuleMock()

const repositoryFake = {
  resolveProfileForDocument,
  upsertIdentity,
  upsertSourceLink,
  appendEventIfNew,
  findFinalizedForRadarSync,
  findSourceLinkBySource,
  deleteSourceLinkById,
  removeObsoleteContractIdentity,
  deleteOrphanRadarProfileIfEmpty,
}

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {},
}))

mock.module("@/lib/radar/team-has-radar-feature", () => ({
  teamHasRadarFeature: mock(async () => true),
}))

const { RadarService } = await import("@/app/api/services/radar/RadarService")
const { SyncFinalizedToRadarUseCase } = await import(
  "@/app/api/useCases/radar/SyncFinalizedToRadarUseCase"
)

const radarService = new RadarService(
  repositoryFake as unknown as ConstructorParameters<typeof RadarService>[0]
)
const syncFinalizedToRadarUseCase = new SyncFinalizedToRadarUseCase(radarService)

const scope = {
  teamId: "team-1",
  ctx: { profileId: "system", teamMember: { role: "system", functions: [] as string[] } },
}

const birthDate = new Date("1990-01-15T00:00:00.000Z")
const updatedAt = new Date("2026-08-01T12:00:00.000Z")

function finalizedFixture(overrides?: {
  holderDocument?: string
  holderCnpj?: string | null
  dependents?: Array<{
    id: string
    name: string
    document: string | null
    birthDate: Date
    parentesco: string
  }>
}) {
  return {
    id: "finalized-1",
    leadId: "lead-1",
    finalizedDateAt: updatedAt,
    updatedAt,
    createdAt: updatedAt,
    holder: {
      id: "holder-1",
      name: "Titular Silva",
      document: overrides?.holderDocument ?? "123.456.789-09",
      cnpj: overrides?.holderCnpj ?? null,
      birthDate,
    },
    dependents: overrides?.dependents ?? [
      {
        id: "dep-with-doc",
        name: "Dependente Com Doc",
        document: "987.654.321-00",
        birthDate,
        parentesco: "filho",
      },
      {
        id: "dep-without-doc",
        name: "Dependente Sem Doc",
        document: null,
        birthDate,
        parentesco: "cônjuge",
      },
    ],
  }
}

describe("SyncFinalizedToRadarUseCase / syncFromFinalized (D14)", () => {
  beforeEach(() => {
    resolveProfileForDocument.mockReset()
    upsertIdentity.mockReset()
    upsertSourceLink.mockReset()
    appendEventIfNew.mockReset()
    findFinalizedForRadarSync.mockReset()
    findSourceLinkBySource.mockReset()
    deleteSourceLinkById.mockReset()
    removeObsoleteContractIdentity.mockReset()
    deleteOrphanRadarProfileIfEmpty.mockReset()

    resolveProfileForDocument.mockImplementation(async () => ({
      profile: { id: `profile-${Math.random().toString(36).slice(2, 8)}` },
      wasExisting: false,
    }))
    upsertIdentity.mockImplementation(async () => ({}))
    upsertSourceLink.mockImplementation(async () => ({}))
    appendEventIfNew.mockImplementation(async () => ({}))
    findSourceLinkBySource.mockImplementation(async () => null)
    deleteSourceLinkById.mockImplementation(async () => undefined)
    removeObsoleteContractIdentity.mockImplementation(async () => ({ removed: 0 }))
    deleteOrphanRadarProfileIfEmpty.mockImplementation(async () => ({ deleted: false }))
  })

  it("cria perfil para titular e dependente com documento; pula dependente sem documento", async () => {
    findFinalizedForRadarSync.mockImplementation(async () => [finalizedFixture()])

    const result = await radarService.syncFromFinalized(scope, { finalizedId: "finalized-1" })

    expect(result.created).toBe(2)
    expect(result.skipped).toBe(1)
    expect(result.enriched).toBe(0)
    expect(result.errors).toEqual([])

    const identityTypes = resolveProfileForDocument.mock.calls.map(
      (call) => call[0].identityType
    )
    expect(identityTypes).toEqual(["contract_holder", "contract_dependent"])

    const docs = resolveProfileForDocument.mock.calls.map(
      (call) => call[0].normalizedDocument
    )
    expect(docs).toEqual(["12345678909", "98765432100"])
  })

  it("reprocessamento é idempotente — enriquecer em vez de duplicar", async () => {
    findFinalizedForRadarSync.mockImplementation(async () => [
      finalizedFixture({
        dependents: [
          {
            id: "dep-with-doc",
            name: "Dependente Com Doc",
            document: "987.654.321-00",
            birthDate,
            parentesco: "filho",
          },
        ],
      }),
    ])

    resolveProfileForDocument.mockImplementation(async () => ({
      profile: { id: "profile-existing" },
      wasExisting: true,
    }))

    const first = await radarService.syncFromFinalized(scope, { finalizedId: "finalized-1" })
    const second = await radarService.syncFromFinalized(scope, { finalizedId: "finalized-1" })

    expect(first.enriched).toBe(2)
    expect(first.created).toBe(0)
    expect(second.enriched).toBe(2)
    expect(second.created).toBe(0)
    expect(upsertIdentity).toHaveBeenCalled()
    expect(upsertSourceLink).toHaveBeenCalled()
  })

  it("UseCase retorna Output válido e rejeita input sem id", async () => {
    findFinalizedForRadarSync.mockImplementation(async () => [finalizedFixture()])

    const ok = await syncFinalizedToRadarUseCase.execute({
      teamId: "team-1",
      finalizedId: "finalized-1",
    })
    expect(ok.isValid).toBe(true)
    expect(ok.result).toMatchObject({ created: 2, skipped: 1 })

    const bad = await syncFinalizedToRadarUseCase.execute({ teamId: "team-1" })
    expect(bad.isValid).toBe(false)
    expect(bad.errorMessages[0]).toContain("finalizedId, leadId ou leadIds")
  })

  it("titular sem documento não gera perfil", async () => {
    findFinalizedForRadarSync.mockImplementation(async () => [
      finalizedFixture({
        holderDocument: "   ",
        dependents: [],
      }),
    ])

    const result = await radarService.syncFromFinalized(scope, { finalizedId: "finalized-1" })
    expect(result.skipped).toBe(1)
    expect(result.created).toBe(0)
    expect(resolveProfileForDocument).not.toHaveBeenCalled()
    expect(deleteSourceLinkById).not.toHaveBeenCalled()
  })

  it("ao limpar documento, remove source link e identidade/perfil obsoletos", async () => {
    findFinalizedForRadarSync.mockImplementation(async () => [
      finalizedFixture({
        holderDocument: "   ",
        dependents: [],
      }),
    ])
    findSourceLinkBySource.mockImplementation(async () => ({
      id: "link-stale",
      profileId: "stale-profile",
    }))

    const result = await radarService.syncFromFinalized(scope, { finalizedId: "finalized-1" })

    expect(result.skipped).toBe(1)
    expect(resolveProfileForDocument).not.toHaveBeenCalled()
    expect(deleteSourceLinkById).toHaveBeenCalledWith("link-stale")
    expect(removeObsoleteContractIdentity).toHaveBeenCalledWith({
      teamId: "team-1",
      profileId: "stale-profile",
      identityType: "contract_holder",
      keepNormalizedDocument: null,
    })
    expect(deleteOrphanRadarProfileIfEmpty).toHaveBeenCalledWith({
      teamId: "team-1",
      profileId: "stale-profile",
    })
  })

  it("ao mudar documento, remove identidade obsoleta do perfil anterior", async () => {
    findFinalizedForRadarSync.mockImplementation(async () => [
      finalizedFixture({
        holderDocument: "111.222.333-44",
        dependents: [],
      }),
    ])
    findSourceLinkBySource.mockImplementation(async () => ({
      id: "link-1",
      profileId: "old-profile",
    }))
    resolveProfileForDocument.mockImplementation(async () => ({
      profile: { id: "new-profile" },
      wasExisting: false,
    }))

    await radarService.syncFromFinalized(scope, { finalizedId: "finalized-1" })

    expect(removeObsoleteContractIdentity).toHaveBeenCalledWith({
      teamId: "team-1",
      profileId: "old-profile",
      identityType: "contract_holder",
      keepNormalizedDocument: "11122233344",
    })
    expect(deleteOrphanRadarProfileIfEmpty).toHaveBeenCalledWith({
      teamId: "team-1",
      profileId: "old-profile",
    })
  })

  it("titular corporativo usa CNPJ quando document (CPF) está vazio", async () => {
    findFinalizedForRadarSync.mockImplementation(async () => [
      finalizedFixture({
        holderDocument: "",
        holderCnpj: "12.345.678/0001-99",
        dependents: [],
      }),
    ])

    const result = await radarService.syncFromFinalized(scope, { finalizedId: "finalized-1" })

    expect(result.created).toBe(1)
    expect(result.skipped).toBe(0)
    expect(resolveProfileForDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        identityType: "contract_holder",
        normalizedDocument: "12345678000199",
      })
    )
  })
})
