import { describe, expect, it } from "bun:test"
import { selfCheckoutRequestSchema } from "./contracts"

const base = {
  companyLegalName: "Corretora Exemplo Ltda",
  cnpj: "11222333000181",
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "11999999999",
  cycle: "monthly",
  termsAccepted: true,
}

describe("selfCheckoutRequestSchema: adicionais", () => {
  it("aceita ausente, 0 e 50", () => {
    expect(selfCheckoutRequestSchema.safeParse(base).success).toBe(true)
    expect(selfCheckoutRequestSchema.safeParse({ ...base, extraUsers: 0, extraTeams: 0 }).success).toBe(true)
    const max = selfCheckoutRequestSchema.safeParse({ ...base, extraUsers: 50, extraTeams: 50 })
    expect(max.success && max.data.extraUsers).toBe(50)
  })

  it.each([
    ["extraUsers", 51],
    ["extraTeams", 51],
    ["extraUsers", -1],
    ["extraTeams", 1.5],
    ["extraUsers", "3"],
  ])("recusa %s = %p", (field, value) => {
    expect(selfCheckoutRequestSchema.safeParse({ ...base, [field]: value }).success).toBe(false)
  })
})
