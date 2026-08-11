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

mock.module("@/app/api/useCases/radar/GetLeadRadarEngagementUseCase", () => ({
  getLeadRadarEngagementUseCase: {
    execute: mock(async () => ({})),
  },
}))

const { GET } = await import("./route")
const { getRadarAccess } = await import("@/app/api/v1/radar/utils/getRadarAccess")
const { getLeadRadarEngagementUseCase } = await import(
  "@/app/api/useCases/radar/GetLeadRadarEngagementUseCase"
)

const mockAccess = {
  error: null,
  status: 200,
  access: {
    teamId: "team-1",
    profileId: "profile-1",
    teamMember: { id: "tm-1", role: "manager" },
  },
}

function makeRequest(leadId: string): NextRequest {
  return new NextRequest(`http://localhost/api/v1/radar/profiles/by-lead/${leadId}/engagement`)
}

describe("GET /api/v1/radar/profiles/by-lead/[leadId]/engagement", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    ;(getLeadRadarEngagementUseCase.execute as ReturnType<typeof mock>).mockReset()
  })

  it("retorna 401 quando sem acesso", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: {
        isValid: false,
        successMessages: [],
        errorMessages: ["Não autorizado"],
        result: null,
      },
      status: 401,
      access: null,
    })
    const res = await GET(makeRequest("lead-1"), { params: Promise.resolve({ leadId: "lead-1" }) })
    expect(res.status).toBe(401)
  })

  it("retorna notFound quando lead não tem perfil Radar", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(getLeadRadarEngagementUseCase.execute as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { notFound: true },
    })
    const res = await GET(makeRequest("lead-missing"), {
      params: Promise.resolve({ leadId: "lead-missing" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { notFound: true } }
    expect(body.result.notFound).toBe(true)
  })

  it("retorna score, band e topEvents quando há perfil", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(getLeadRadarEngagementUseCase.execute as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: {
        notFound: false,
        profileId: "radar-1",
        score: 72,
        band: "hot",
        topEvents: [
          { eventType: "form.completed", occurredAt: "2026-08-01T12:00:00.000Z", contribution: 50 },
        ],
      },
    })
    const res = await GET(makeRequest("lead-1"), { params: Promise.resolve({ leadId: "lead-1" }) })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      result: { score: number; band: string; topEvents: unknown[] }
    }
    expect(body.result.score).toBe(72)
    expect(body.result.band).toBe("hot")
    expect(body.result.topEvents).toHaveLength(1)
  })
})
