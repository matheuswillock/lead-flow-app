import { describe, it, expect, mock, beforeEach } from "bun:test"
import { NextRequest } from "next/server"

mock.module("server-only", () => ({}))

mock.module("@/app/api/v1/radar/utils/getRadarAccess", () => ({
  getRadarAccess: mock(async () => ({})),
  teamContextFromRadarAccess: mock(() => ({ profileId: "profile-1", teamMember: { id: "tm-1" } })),
}))

mock.module("@/app/api/useCases/radar/RadarUseCase", () => ({
  customerDataPlatformUseCase: {
    getProfileContracts: mock(async () => ({})),
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

  it("retorna 200 com portfolio atual e histórico finalized", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.getProfileContracts as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: {
        portfolio: {
          id: "pf-1",
          leadId: "lead-1",
          portfolioStatus: "active",
          renewalStatus: "to_renew",
          renewalAmount: 1500,
          source: "crm",
          note: null,
          lastContactAt: "2026-06-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
        finalized: [
          {
            id: "lf-1",
            leadId: "lead-1",
            finalizedDateAt: "2025-12-01T00:00:00.000Z",
            startDateAt: "2025-12-15T00:00:00.000Z",
            amount: 1200,
            contractType: "individual",
            operadora: "Unimed",
            productName: "Premium",
            notes: null,
            createdAt: "2025-12-01T00:00:00.000Z",
            holder: {
              id: "h-1",
              name: "Titular",
              razaoSocial: null,
              birthDate: "1990-01-01T00:00:00.000Z",
              document: "12345678901",
              cnpj: null,
            },
            dependents: [
              {
                id: "d-1",
                name: "Dependente",
                birthDate: "2015-01-01T00:00:00.000Z",
                parentesco: "Filho(a)",
                document: null,
              },
            ],
          },
        ],
      },
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      result: { portfolio: { renewalStatus: string } | null; finalized: unknown[] }
    }
    expect(body.result.portfolio?.renewalStatus).toBe("to_renew")
    expect(body.result.finalized).toHaveLength(1)
  })

  it("retorna 200 com portfolio null e finalized vazio", async () => {
    ;(getRadarAccess as ReturnType<typeof mock>).mockResolvedValueOnce(mockAccess)
    ;(customerDataPlatformUseCase.getProfileContracts as ReturnType<typeof mock>).mockResolvedValueOnce({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { portfolio: null, finalized: [] },
    })
    const [req, params] = makeRequest()
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { portfolio: null; finalized: unknown[] } }
    expect(body.result.portfolio).toBeNull()
    expect(body.result.finalized).toHaveLength(0)
  })

  it("retorna 404 quando perfil não existe", async () => {
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
