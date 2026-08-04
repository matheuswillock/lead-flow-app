import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

const HEALTH_PLAN_ERROR_MESSAGES = {
  MISSING_SUPABASE_ID: "ID do usuário é obrigatório",
  PROFILE_NOT_FOUND: "Perfil não encontrado",
  FORBIDDEN_CREATE: "Acesso negado para criar plano de saúde",
  INVALID_NAME: "Nome do plano de saúde é obrigatório",
  DUPLICATED_NAME: "Plano de saúde já existe",
  INTERNAL_LIST_ERROR: "Erro ao listar planos de saúde",
  INTERNAL_CREATE_ERROR: "Erro ao criar plano de saúde",
} as const

const listHealthPlansMock = mock(async (_supabaseId: string) => new Output(true, [], [], { healthPlans: [] }))
const createHealthPlanMock = mock(
  async (_supabaseId: string, _name: string) =>
    new Output(true, ["ok"], [], { healthPlan: { id: "hp-1", name: "Plano A" } })
)

mock.module("@/app/api/useCases/healthPlans/HealthPlanUseCase", () => ({
  healthPlanUseCase: {
    listHealthPlans: listHealthPlansMock,
    createHealthPlan: createHealthPlanMock,
  },
  HEALTH_PLAN_ERROR_MESSAGES,
}))

mock.module("@/lib/cache/invalidation", () => ({
  invalidateHealthPlansCache: mock(() => undefined),
}))

const { GET, POST } = await import("./route")

function makeGetRequest(supabaseId?: string): NextRequest {
  const headers = new Headers()
  if (supabaseId !== undefined) {
    headers.set("x-supabase-user-id", supabaseId)
  }
  return new NextRequest("http://localhost/api/v1/health-plans", {
    method: "GET",
    headers,
  })
}

describe("GET /api/v1/health-plans", () => {
  beforeEach(() => {
    listHealthPlansMock.mockReset()
    listHealthPlansMock.mockImplementation(
      async () => new Output(true, [], [], { healthPlans: [] })
    )
  })

  it("retorna 200 quando a listagem é válida", async () => {
    const res = await GET(makeGetRequest("user-1"))
    expect(res.status).toBe(200)
  })

  it("retorna 401 quando falta supabase id", async () => {
    listHealthPlansMock.mockResolvedValueOnce(
      new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.MISSING_SUPABASE_ID], null)
    )
    const res = await GET(makeGetRequest(""))
    expect(res.status).toBe(401)
  })

  it("retorna 404 quando perfil não existe", async () => {
    listHealthPlansMock.mockResolvedValueOnce(
      new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.PROFILE_NOT_FOUND], null)
    )
    const res = await GET(makeGetRequest("missing"))
    expect(res.status).toBe(404)
  })

  it("retorna 500 (não 400) quando o use case falha com erro interno", async () => {
    listHealthPlansMock.mockResolvedValueOnce(
      new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.INTERNAL_LIST_ERROR], null)
    )
    const res = await GET(makeGetRequest("user-1"))
    expect(res.status).toBe(500)
  })
})

describe("POST /api/v1/health-plans", () => {
  beforeEach(() => {
    createHealthPlanMock.mockReset()
    createHealthPlanMock.mockImplementation(
      async () =>
        new Output(true, ["Plano de saúde criado com sucesso"], [], {
          healthPlan: { id: "hp-1", name: "Plano A" },
        })
    )
  })

  it("retorna 500 (não 400) quando o use case falha com erro interno", async () => {
    createHealthPlanMock.mockResolvedValueOnce(
      new Output(false, [], [HEALTH_PLAN_ERROR_MESSAGES.INTERNAL_CREATE_ERROR], null)
    )
    const req = new NextRequest("http://localhost/api/v1/health-plans", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-supabase-user-id": "user-1",
      },
      body: JSON.stringify({ name: "Plano A" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it("retorna 400 para body inválido", async () => {
    const req = new NextRequest("http://localhost/api/v1/health-plans", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-supabase-user-id": "user-1",
      },
      body: JSON.stringify({ name: "" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
