import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextRequest } from "next/server"

const profileExistsInScope = mock(async () => true)
const listProfileTouchpointEventMarkers = mock(
  async (): Promise<Array<{ eventType: string; occurredAt: Date }>> => []
)

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess: mock(async () => ({})),
  teamContextFromRadarAccess: mock(() => ({ profileId: "profile-1", teamMember: { id: "tm-1" } })),
}))

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    profileExistsInScope,
    listProfileTouchpointEventMarkers,
  },
}))

const { getRadarAccess } = await import("@/app/api/v1/radar/utils/getRadarAccess")
const { GET } = await import("./route")

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

const sameDay = new Date("2026-08-05T15:00:00.000Z")

function emailLifecycleEvents(count: number): Array<{ eventType: string; occurredAt: Date }> {
  const types = ["email.sent", "email.delivered", "email.opened", "email.clicked"]
  return Array.from({ length: count }, (_, index) => ({
    eventType: types[index % types.length]!,
    occurredAt: new Date(sameDay.getTime() + index * 1000),
  }))
}

describe("GET /api/v1/radar/profiles/[id]/touchpoints", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    profileExistsInScope.mockReset()
    listProfileTouchpointEventMarkers.mockReset()
    profileExistsInScope.mockResolvedValue(true)
    listProfileTouchpointEventMarkers.mockResolvedValue([])
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

  it("retorna 200 com breakdown vazio para perfil sem eventos", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    listProfileTouchpointEventMarkers.mockResolvedValueOnce([])
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { total: number; breakdown: unknown[] } }
    expect(body.result.total).toBe(0)
    expect(body.result.breakdown).toHaveLength(0)
  })

  it("E4: 8 e-mail + 3 form.viewed no mesmo dia → 1+1; CRM fora do total/lista", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    listProfileTouchpointEventMarkers.mockResolvedValueOnce([
      ...emailLifecycleEvents(8),
      { eventType: "form.viewed", occurredAt: new Date(sameDay.getTime() + 10_000) },
      { eventType: "form.viewed", occurredAt: new Date(sameDay.getTime() + 11_000) },
      { eventType: "form.viewed", occurredAt: new Date(sameDay.getTime() + 12_000) },
      { eventType: "lead.created", occurredAt: new Date(sameDay.getTime() + 13_000) },
      { eventType: "lead.status_changed", occurredAt: new Date(sameDay.getTime() + 14_000) },
      { eventType: "lead.milestone.new_opportunity", occurredAt: new Date(sameDay.getTime() + 15_000) },
      { eventType: "profile.first_contact", occurredAt: new Date(sameDay.getTime() + 16_000) },
      { eventType: "portfolio.synced", occurredAt: new Date(sameDay.getTime() + 17_000) },
    ])

    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)

    const body = (await res.json()) as {
      result: {
        total: number
        breakdown: Array<{ channel: string; count: number }>
      }
    }

    expect(body.result.total).toBe(2)
    expect(body.result.breakdown).toHaveLength(2)

    const byChannel = Object.fromEntries(
      body.result.breakdown.map((item) => [item.channel, item.count])
    )
    expect(byChannel["E-mail"]).toBe(1)
    expect(byChannel["Formulário"]).toBe(1)
    expect(byChannel["CRM"]).toBeUndefined()
    expect(body.result.breakdown.some((item) => item.channel === "CRM")).toBe(false)
  })
})
