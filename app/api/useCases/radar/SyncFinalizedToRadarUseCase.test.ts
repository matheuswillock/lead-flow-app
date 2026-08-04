import { beforeEach, describe, expect, it, mock } from "bun:test"

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

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    resolveProfileForDocument,
    upsertIdentity,
    upsertSourceLink,
    appendEventIfNew,
    findFinalizedForRadarSync,
  },
}))

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {},
}))

mock.module("@/lib/radar/team-has-radar-feature", () => ({
  teamHasRadarFeature: mock(async () => true),
}))

const { radarService } = await import("@/app/api/services/radar/RadarService")
const { syncFinalizedToRadarUseCase } = await import(
  "@/app/api/useCases/radar/SyncFinalizedToRadarUseCase"
)

const scope = {
  teamId: "team-1",
  ctx: { profileId: "system", teamMember: { role: "system", functions: [] as string[] } },
}

const birthDate = new Date("1990-01-15T00:00:00.000Z")
const updatedAt = new Date("2026-08-01T12:00:00.000Z")

function finalizedFixture(overrides?: {
  holderDocument?: string
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

    resolveProfileForDocument.mockImplementation(async () => ({
      profile: { id: `profile-${Math.random().toString(36).slice(2, 8)}` },
      wasExisting: false,
    }))
    upsertIdentity.mockImplementation(async () => ({}))
    upsertSourceLink.mockImplementation(async () => ({}))
    appendEventIfNew.mockImplementation(async () => ({}))
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
    expect(bad.errorMessages[0]).toContain("finalizedId ou leadId")
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
  })
})
