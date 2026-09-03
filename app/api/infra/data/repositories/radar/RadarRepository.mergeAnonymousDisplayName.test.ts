import { describe, expect, it, mock } from "bun:test"

/**
 * Adenda E6b (SPEC 10, decisão do owner 02/09) — caso real KKJ (perfil
 * `86426c89`): o merge de `mergeProfilesWithTx` copiava o texto literal
 * "Visitante Anônimo" do perfil PERDEDOR para o VENCEDOR sempre que o
 * vencedor tinha `displayName` vazio — mesmo quando o vencedor era o perfil
 * identificado (telefone/e-mail conhecidos) que devia ganhar um nome de
 * verdade, não herdar o rótulo de anônimo do perdedor.
 *
 * O guard já existia do lado do VENCEDOR (`winnerHasUsableName` exclui
 * "Visitante Anônimo"), mas faltava o mesmo guard do lado do PERDEDOR — a
 * fonte que alimenta o fallback.
 */

const radarIdentityFindManyMock = mock(async () => [] as unknown[])
const radarIdentityUpdateManyMock = mock(async () => ({ count: 0 }))
const radarSourceLinkFindManyMock = mock(async () => [] as unknown[])
const radarEventFindManyMock = mock(async () => [] as unknown[])
const radarChannelConsentFindManyMock = mock(async () => [] as unknown[])
const radarProfileUpdateMock = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "winning-profile",
  ...args.data,
}))
const radarProfileDeleteMock = mock(async () => ({}))

function makeTx(profiles: Record<string, { displayName: string; normalizedName: string }>) {
  return {
    radarIdentity: { findMany: radarIdentityFindManyMock, updateMany: radarIdentityUpdateManyMock },
    radarSourceLink: {
      findMany: radarSourceLinkFindManyMock,
      findFirst: mock(async () => null),
      delete: mock(async () => ({})),
      update: mock(async () => ({})),
    },
    radarEvent: {
      findMany: radarEventFindManyMock,
      findFirst: mock(async () => null),
      update: mock(async () => ({})),
      delete: mock(async () => ({})),
    },
    radarChannelConsent: {
      findMany: radarChannelConsentFindManyMock,
      findUnique: mock(async () => null),
      update: mock(async () => ({})),
      delete: mock(async () => ({})),
    },
    radarProfile: {
      findUnique: mock(async ({ where }: { where: { id: string } }) => ({
        displayName: profiles[where.id]?.displayName ?? "",
        normalizedName: profiles[where.id]?.normalizedName ?? "",
        displayPhone: null,
        normalizedPhone: null,
        primaryEmail: null,
        normalizedPrimaryEmail: null,
      })),
      update: radarProfileUpdateMock,
      delete: radarProfileDeleteMock,
    },
  }
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx(currentProfiles)),
    radarEvent: { findMany: mock(async () => []) },
    radarProfile: { updateMany: mock(async () => ({ count: 1 })) },
    backofficeRadarEngagementWeight: { findMany: mock(async () => []) },
    backofficeRadarEngagementConfig: { findFirst: mock(async () => null) },
    backofficeFormEngagementScoreRule: { findMany: mock(async () => []) },
  },
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { RadarRepository } = await import(
  "@/app/api/infra/data/repositories/radar/RadarRepository"
)

let currentProfiles: Record<string, { displayName: string; normalizedName: string }> = {}

describe("mergeProfilesWithTx — nome anônimo nunca vence via merge (E6b)", () => {
  it("vencedor com displayName vazio NÃO herda o texto 'Visitante Anônimo' do perdedor", async () => {
    currentProfiles = {
      "winning-profile": { displayName: "", normalizedName: "" },
      "losing-profile": { displayName: "Visitante Anônimo", normalizedName: "visitante anonimo" },
    }
    radarProfileUpdateMock.mockClear()

    const repo = new RadarRepository()
    await repo.mergePublicFormProfiles("team-1", "losing-profile", "winning-profile")

    const [call] = radarProfileUpdateMock.mock.calls as unknown as [[{ data: Record<string, unknown> }]]
    expect(call[0].data.displayName).toBeUndefined()
    expect(call[0].data.normalizedName).toBeUndefined()
  })

  it("vencedor sem nome ainda herda um nome USÁVEL do perdedor (comportamento existente preservado)", async () => {
    currentProfiles = {
      "winning-profile": { displayName: "", normalizedName: "" },
      "losing-profile": { displayName: "Maria Silva", normalizedName: "maria silva" },
    }
    radarProfileUpdateMock.mockClear()

    const repo = new RadarRepository()
    await repo.mergePublicFormProfiles("team-1", "losing-profile", "winning-profile")

    const [call] = radarProfileUpdateMock.mock.calls as unknown as [[{ data: Record<string, unknown> }]]
    expect(call[0].data.displayName).toBe("Maria Silva")
    expect(call[0].data.normalizedName).toBe("maria silva")
  })

  it("vencedor já com nome usável mantém o próprio nome (não mexe)", async () => {
    currentProfiles = {
      "winning-profile": { displayName: "João", normalizedName: "joao" },
      "losing-profile": { displayName: "Visitante Anônimo", normalizedName: "visitante anonimo" },
    }
    radarProfileUpdateMock.mockClear()

    const repo = new RadarRepository()
    await repo.mergePublicFormProfiles("team-1", "losing-profile", "winning-profile")

    const [call] = radarProfileUpdateMock.mock.calls as unknown as [[{ data: Record<string, unknown> }]]
    expect(call[0].data.displayName).toBeUndefined()
    expect(call[0].data.normalizedName).toBeUndefined()
  })
})
