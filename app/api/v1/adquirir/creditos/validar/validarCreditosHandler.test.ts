import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { handleValidarCreditos, type ValidarCreditosHandlerDeps } from "./validarCreditosHandler"

const managerAccess = {
  teamId: "team-1",
  profileId: "profile-1",
  teamMember: { role: "manager", functions: [] },
} as unknown as TeamAccess

const executeMock = mock(
  async (..._args: unknown[]) => new Output(true, [], [], { checkoutUrl: "/addon-checkout/p-1", plan: "25k" }),
)

function buildDeps(overrides: Partial<ValidarCreditosHandlerDeps> = {}): ValidarCreditosHandlerDeps {
  return {
    getTeamAccess: async () => ({ access: managerAccess }),
    validarCreditos: { execute: executeMock as never },
    ...overrides,
  }
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/adquirir/creditos/validar", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST adquirir/creditos/validar", () => {
  beforeEach(() => executeMock.mockClear())

  it("anônimo recebe 401 e nenhuma compra é criada", async () => {
    const deps = buildDeps({
      getTeamAccess: async () => ({ error: new Output(false, [], ["ID do usuário é obrigatório"], null), status: 401 }),
    })

    const response = await handleValidarCreditos(postRequest({ plan: "25k" }), deps)

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("quem não é manager recebe 403", async () => {
    const memberAccess = { ...managerAccess, teamMember: { role: "member", functions: [] } } as unknown as TeamAccess
    const deps = buildDeps({ getTeamAccess: async () => ({ access: memberAccess }) })

    const response = await handleValidarCreditos(postRequest({ plan: "25k" }), deps)

    expect(response.status).toBe(403)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("e-mail enviado no body é ignorado: a compra usa o acesso autenticado", async () => {
    const response = await handleValidarCreditos(postRequest({ plan: "25k", email: "vitima@example.test" }), buildDeps())

    expect(response.status).toBe(200)
    expect(executeMock).toHaveBeenCalledWith({ plan: "25k", access: managerAccess })
  })

  it("plano ausente recebe 400", async () => {
    const response = await handleValidarCreditos(postRequest({}), buildDeps())

    expect(response.status).toBe(400)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("falha do use case vira 400", async () => {
    executeMock.mockResolvedValueOnce(new Output(false, [], ["Plano inválido"], null))

    const response = await handleValidarCreditos(postRequest({ plan: "10k" }), buildDeps())

    expect(response.status).toBe(400)
  })
})
