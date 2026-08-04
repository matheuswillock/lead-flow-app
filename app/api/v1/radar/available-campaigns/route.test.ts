import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextRequest } from "next/server"

mock.module("server-only", () => ({}))

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess: mock(async () => ({})),
  teamContextFromRadarAccess: mock(() => ({ profileId: "profile-1", teamMember: { id: "tm-1" } })),
}))

mock.module("@/app/api/useCases/radar/RadarUseCase", () => ({
  customerDataPlatformUseCase: {
    listAvailableCampaigns: mock(async () => ({})),
  },
}))

const { GET } = await import("./route")
const { getRadarAccess } = await import("@/app/api/v1/radar/utils/getRadarAccess")
const { customerDataPlatformUseCase } = await import("@/app/api/useCases/radar/RadarUseCase")

const mockAccess = {
  error: null,
  status: 200,
  access: {
    teamId: "team-1",
    profileId: "profile-1",
    teamMember: { id: "tm-1", role: "manager" },
  },
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/v1/radar/available-campaigns")
}

describe("GET /api/v1/radar/available-campaigns", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    ;(customerDataPlatformUseCase.listAvailableCampaigns as ReturnType<typeof mock>).mockReset()
  })

  it("retorna 401 quando sem acesso", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: { isValid: false, successMessages: [], errorMessages: ["Não autorizado"], result: null },
      status: 401,
      access: null,
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("retorna 200 com campanhas do time", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.listAvailableCampaigns as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: {
        campaigns: [
          { id: "11111111-1111-4111-8111-111111111111", name: "Campanha A" },
          { id: "22222222-2222-4222-8222-222222222222", name: "Campanha B" },
        ],
      },
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { campaigns: Array<{ id: string; name: string }> } }
    expect(body.result.campaigns).toHaveLength(2)
    expect(body.result.campaigns[0].name).toBe("Campanha A")
  })
})
