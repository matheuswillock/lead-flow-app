import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextRequest } from "next/server"
import { GET } from "./route"

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess: mock(async () => ({})),
  teamContextFromRadarAccess: mock(() => ({ profileId: "profile-1", teamMember: { id: "tm-1" } })),
}))

mock.module("@/app/api/useCases/radar/RadarUseCase", () => ({
  customerDataPlatformUseCase: {
    getProfileContracts: mock(async () => ({})),
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
  const req = new NextRequest("http://localhost/api/v1/radar/profiles/p-1/contracts")
  const params = { params: Promise.resolve({ id: "p-1" }) }
  return [req, params]
}

describe("GET /api/v1/radar/profiles/[id]/contracts", () => {
  beforeEach(() => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockReset()
    ;(customerDataPlatformUseCase.getProfileContracts as ReturnType<typeof mock>).mockReset()
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

  it("retorna 200 com contrato atual e histórico", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.getProfileContracts as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: {
        current: {
          id: "portfolio-1",
          portfolioStatus: "active",
          renewalStatus: "to_renew",
          renewalAmount: "1500.00",
          source: "crm",
          lastContactAt: "2026-01-15T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-15T00:00:00.000Z",
        },
        history: [
          {
            id: "finalized-1",
            finalizedDateAt: "2025-12-01T00:00:00.000Z",
            amount: "2000.00",
            contractType: "individual",
            operadora: "Bradesco Saúde",
            productName: "Plano Nacional",
            createdAt: "2025-12-01T00:00:00.000Z",
            holder: { id: "holder-1", name: "João Silva", document: "123.456.789-00", birthDate: "1985-05-10T00:00:00.000Z" },
            dependents: [],
          },
        ],
      },
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      result: { current: { portfolioStatus: string } | null; history: unknown[] }
    }
    expect(body.result.current?.portfolioStatus).toBe("active")
    expect(body.result.history).toHaveLength(1)
  })

  it("retorna 200 com current null quando sem carteira", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.getProfileContracts as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { current: null, history: [] },
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { current: null; history: unknown[] } }
    expect(body.result.current).toBeNull()
    expect(body.result.history).toHaveLength(0)
  })

  it("retorna 404 para perfil inexistente", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.getProfileContracts as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: false,
      successMessages: [],
      errorMessages: ["Perfil não encontrado"],
      result: null,
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(404)
  })
})
