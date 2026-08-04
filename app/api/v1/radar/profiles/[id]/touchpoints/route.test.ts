import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextRequest } from "next/server"
import { GET } from "./route"

// Minimal mocks required for the route
mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess: mock(async () => ({})),
  teamContextFromRadarAccess: mock(() => ({ profileId: "profile-1", teamMember: { id: "tm-1" } })),
}))

mock.module("@/app/api/useCases/radar/RadarUseCase", () => ({
  customerDataPlatformUseCase: {
    getProfileTouchpoints: mock(async () => ({})),
  },
}))

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

function makeRequest(): [NextRequest, { params: Promise<{ id: string }> }] {
  const req = new NextRequest("http://localhost/api/v1/radar/profiles/p-1/touchpoints")
  const params = { params: Promise.resolve({ id: "p-1" }) }
  return [req, params]
}

describe("GET /api/v1/radar/profiles/[id]/touchpoints", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    ;(customerDataPlatformUseCase.getProfileTouchpoints as ReturnType<typeof mock>).mockReset()
  })

  it("retorna 401 quando sem acesso", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: { isValid: false, successMessages: [], errorMessages: ["Não autorizado"], result: null },
      status: 401,
      access: null,
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(401)
  })

  it("retorna 200 com breakdown por canal", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.getProfileTouchpoints as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: {
        total: 5,
        breakdown: [
          { channel: "E-mail", count: 3, firstEventAt: "2026-01-01T00:00:00.000Z", lastEventAt: "2026-06-01T00:00:00.000Z" },
          { channel: "CRM", count: 2, firstEventAt: "2026-02-01T00:00:00.000Z", lastEventAt: "2026-05-01T00:00:00.000Z" },
        ],
      },
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { total: number; breakdown: unknown[] } }
    expect(body.result.total).toBe(5)
    expect(body.result.breakdown).toHaveLength(2)
  })

  it("retorna 200 com breakdown vazio para perfil sem eventos", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.getProfileTouchpoints as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { total: 0, breakdown: [] },
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { total: number; breakdown: unknown[] } }
    expect(body.result.total).toBe(0)
    expect(body.result.breakdown).toHaveLength(0)
  })
})
