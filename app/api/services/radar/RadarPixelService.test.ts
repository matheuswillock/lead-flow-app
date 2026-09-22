import { describe, it, expect, mock } from "bun:test"
import {
  radarRepositoryMock,
  registerRadarRepositoryModuleMock,
} from "@/test/support/radar-repository-module-mock"

const findPixelConfigByTeamId = mock(async () => null as unknown)
const upsertPixelConfig = mock(async () => ({
  publicToken: "tok-1",
  allowedOrigins: [] as string[],
  lastUsedAt: null as Date | null,
}))

await registerRadarRepositoryModuleMock()
Object.assign(radarRepositoryMock, {
  findPixelConfigByTeamId,
  upsertPixelConfig,
})

const { radarPixelService } = await import("./RadarPixelService")

const APP_URL = "https://app.exemplo.com"

// T-30.1 (SPEC 30, W27): `originRestrictionActive` reflete `allowedOrigins.length
// > 0` sem alterar o aceite de origem do Pixel (`isOriginAllowed`, que continua
// aceitando qualquer origem com allowlist vazia — DA1, testado separadamente em
// RadarPixelHitUseCase.test.ts).
describe("RadarPixelService — originRestrictionActive (T-30.1)", () => {
  it("allowedOrigins vazio → originRestrictionActive false (getConfig)", async () => {
    findPixelConfigByTeamId.mockClear()
    findPixelConfigByTeamId.mockImplementation(async () => ({
      publicToken: "tok-1",
      allowedOrigins: [],
      lastUsedAt: null,
    }))

    const result = await radarPixelService.getConfig("team-1", APP_URL)

    expect(result.originRestrictionActive).toBe(false)
  })

  it("uma origem configurada → originRestrictionActive true (getConfig)", async () => {
    findPixelConfigByTeamId.mockClear()
    findPixelConfigByTeamId.mockImplementation(async () => ({
      publicToken: "tok-1",
      allowedOrigins: ["https://exemplo.com"],
      lastUsedAt: null,
    }))

    const result = await radarPixelService.getConfig("team-1", APP_URL)

    expect(result.originRestrictionActive).toBe(true)
  })

  it("pixel ainda não configurado → originRestrictionActive false", async () => {
    findPixelConfigByTeamId.mockClear()
    findPixelConfigByTeamId.mockImplementation(async () => null)

    const result = await radarPixelService.getConfig("team-1", APP_URL)

    expect(result.configured).toBe(false)
    expect(result.originRestrictionActive).toBe(false)
  })

  it("allowedOrigins vazio → originRestrictionActive false (saveConfig)", async () => {
    upsertPixelConfig.mockClear()
    upsertPixelConfig.mockImplementation(async () => ({
      publicToken: "tok-1",
      allowedOrigins: [],
      lastUsedAt: null,
    }))

    const result = await radarPixelService.saveConfig("team-1", "profile-1", { allowedOrigins: [] }, APP_URL)

    expect(result.originRestrictionActive).toBe(false)
  })

  it("uma origem configurada → originRestrictionActive true (saveConfig)", async () => {
    upsertPixelConfig.mockClear()
    upsertPixelConfig.mockImplementation(async () => ({
      publicToken: "tok-1",
      allowedOrigins: ["https://exemplo.com"],
      lastUsedAt: null,
    }))

    const result = await radarPixelService.saveConfig(
      "team-1",
      "profile-1",
      { allowedOrigins: ["https://exemplo.com"] },
      APP_URL,
    )

    expect(result.originRestrictionActive).toBe(true)
  })
})
