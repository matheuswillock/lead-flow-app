import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}))

mock.module("server-only", () => ({}))

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess: mock(async () => ({})),
  teamContextFromRadarAccess: mock(() => ({ profileId: "profile-1", teamMember: { id: "tm-1" } })),
}))

mock.module("@/app/api/useCases/radar/RadarUseCase", () => ({
  customerDataPlatformUseCase: {
    listAvailableEventTypes: mock(async () => ({})),
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
  return new NextRequest("http://localhost/api/v1/radar/available-event-types")
}

describe("GET /api/v1/radar/available-event-types", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    ;(customerDataPlatformUseCase.listAvailableEventTypes as ReturnType<typeof mock>).mockReset()
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

  it("retorna 200 com eventTypes distintos do time", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.listAvailableEventTypes as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { eventTypes: ["email.opened", "lead.created", "whatsapp.message_received"] },
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { eventTypes: string[] } }
    expect(body.result.eventTypes).toEqual([
      "email.opened",
      "lead.created",
      "whatsapp.message_received",
    ])
  })

  it("retorna 200 com lista vazia quando o time ainda não tem eventos", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.listAvailableEventTypes as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { eventTypes: [] },
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { eventTypes: string[] } }
    expect(body.result.eventTypes).toEqual([])
  })
})
