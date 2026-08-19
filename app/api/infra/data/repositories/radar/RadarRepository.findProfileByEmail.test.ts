import { describe, expect, it, mock } from "bun:test"

const radarIdentityFindUniqueMock = mock(
  async (_args: unknown) => null as { profileId: string } | null,
)
const radarProfileFindFirstMock = mock(async (_args: unknown) => null as { id: string } | null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    radarIdentity: { findUnique: radarIdentityFindUniqueMock },
    radarProfile: { findFirst: radarProfileFindFirstMock },
  },
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { RadarRepository } = await import(
  "@/app/api/infra/data/repositories/radar/RadarRepository"
)

describe("RadarRepository.findProfileByEmail (achado #6 — findFirst ambíguo)", () => {
  it("resolve pela identidade única (RadarIdentity) quando ela existe, sem ambiguidade", async () => {
    radarIdentityFindUniqueMock.mockImplementationOnce(async () => ({ profileId: "profile-unico" }))
    const repo = new RadarRepository()

    const profile = await repo.findProfileByEmail("team-1", "pessoa@exemplo.com")

    expect(profile).toEqual({ id: "profile-unico" })
    expect(radarProfileFindFirstMock).not.toHaveBeenCalled()
  })

  it("cai no findFirst legado só quando não há RadarIdentity de e-mail registrada", async () => {
    radarIdentityFindUniqueMock.mockImplementationOnce(async () => null)
    radarProfileFindFirstMock.mockImplementationOnce(async () => ({ id: "profile-legado" }))
    const repo = new RadarRepository()

    const profile = await repo.findProfileByEmail("team-1", "legado@exemplo.com")

    expect(profile).toEqual({ id: "profile-legado" })
    expect(radarProfileFindFirstMock).toHaveBeenCalled()
  })

  it("retorna null sem consultar o banco quando o e-mail normalizado é vazio", async () => {
    radarIdentityFindUniqueMock.mockClear()
    const repo = new RadarRepository()
    const profile = await repo.findProfileByEmail("team-1", "")
    expect(profile).toBeNull()
    expect(radarIdentityFindUniqueMock).not.toHaveBeenCalled()
  })
})
