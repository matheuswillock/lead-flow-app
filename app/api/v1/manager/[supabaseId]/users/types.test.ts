import { describe, expect, it } from "bun:test"
import { CreateUserSchema } from "./types"

const base = { name: "Novo Usuário", email: "novo@example.com", role: "operator" as const }

describe("CreateUserSchema — telefone obrigatório", () => {
  it("recusa cadastro sem telefone", () => {
    expect(CreateUserSchema.safeParse(base).success).toBe(false)
  })

  it("recusa telefone com menos de 10 dígitos", () => {
    const result = CreateUserSchema.safeParse({ ...base, phone: "(11) 9999" })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((i) => i.message)).toContain("Telefone inválido")
  })

  it("aceita telefone válido com máscara", () => {
    expect(CreateUserSchema.safeParse({ ...base, phone: "(11) 99999-8888" }).success).toBe(true)
  })
})
