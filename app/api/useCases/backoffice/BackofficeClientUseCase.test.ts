import { describe, expect, it, mock } from "bun:test"
import { BackofficeClientUseCase } from "./BackofficeClientUseCase"

function makeUseCase() {
  const create = mock(async (data: Record<string, unknown>) => ({ ...data }) as never)
  const findById = mock(async (_id: string) => null as unknown)
  const updateAsaasCustomerId = mock(async () => ({}))
  const clientRepo = { create, findById, updateAsaasCustomerId }
  const useCase = new BackofficeClientUseCase(clientRepo as never)
  return { useCase, create, findById, updateAsaasCustomerId }
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

describe("BackofficeClientUseCase.createClient — sem acoplamento a provedor", () => {
  it("cria cliente com CPF só no registro local, sem gravar id de provedor", async () => {
    const { useCase, create, updateAsaasCustomerId } = makeUseCase()

    const result = await useCase.createClient(
      { ...base, phone: "(11) 99999-9999", cpfCnpj: "123.456.789-09" },
      "profile-1"
    )

    expect(result.isValid).toBe(true)
    expect(result.successMessages).toEqual(["Cliente criado com sucesso"])
    expect(create.mock.calls[0]?.[0]).toMatchObject({ cpfCnpj: "123.456.789-09" })
    expect(updateAsaasCustomerId).not.toHaveBeenCalled()
  })

  it("cria cliente sem CPF", async () => {
    const { useCase, create, updateAsaasCustomerId } = makeUseCase()

    const result = await useCase.createClient({ ...base, phone: "(11) 99999-9999" }, "profile-1")

    expect(result.isValid).toBe(true)
    expect(create.mock.calls[0]?.[0]).toMatchObject({ cpfCnpj: undefined })
    expect(updateAsaasCustomerId).not.toHaveBeenCalled()
  })
})

describe("BackofficeClientUseCase.getClientById — cliente legado", () => {
  it("preserva o asaasCustomerId já gravado e não o reescreve", async () => {
    const { useCase, findById, updateAsaasCustomerId } = makeUseCase()
    findById.mockResolvedValueOnce({ id: "c1", asaasCustomerId: "cus_legacy" })

    const result = await useCase.getClientById("c1")

    expect(result.isValid).toBe(true)
    expect(result.result).toMatchObject({ asaasCustomerId: "cus_legacy" })
    expect(updateAsaasCustomerId).not.toHaveBeenCalled()
  })
})
