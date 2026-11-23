import { describe, expect, it, mock } from "bun:test"
import { BackofficeClientUseCase } from "./BackofficeClientUseCase"

function makeUseCase() {
  const create = mock(async (data: Record<string, unknown>) => ({ ...data }) as never)
  const clientRepo = { create, updateAsaasCustomerId: mock(async () => ({})) }
  const asaas = { createCustomer: mock(async () => ({ success: false })) }
  const useCase = new BackofficeClientUseCase(clientRepo as never, asaas as never)
  return { useCase, create }
}

const base = { fullName: "Cliente Novo", email: "novo@example.com" }

describe("BackofficeClientUseCase.createClient — telefone obrigatório", () => {
  it("recusa cadastro sem telefone, sem gravar o cliente", async () => {
    const { useCase, create } = makeUseCase()

    const result = await useCase.createClient(base, "profile-1")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Telefone é obrigatório"])
    expect(create).not.toHaveBeenCalled()
  })

  it("recusa telefone sem dígitos suficientes", async () => {
    const { useCase, create } = makeUseCase()

    const result = await useCase.createClient({ ...base, phone: "abc" }, "profile-1")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Telefone é obrigatório"])
    expect(create).not.toHaveBeenCalled()
  })

  it("cria o cliente quando há telefone válido", async () => {
    const { useCase, create } = makeUseCase()

    const result = await useCase.createClient({ ...base, phone: "(11) 99999-9999" }, "profile-1")

    expect(result.isValid).toBe(true)
    expect(create.mock.calls[0]?.[0]).toMatchObject({ phone: "(11) 99999-9999" })
  })
})
