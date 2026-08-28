import { describe, expect, it } from "bun:test"
import { projectPublicFormAnswerIdentity } from "./public-form-identity-projection"

function project(mappingKey: string | null, value: unknown) {
  return projectPublicFormAnswerIdentity({ mappingKey, value, currentPrimaryEmail: null })
}

describe("projectPublicFormAnswerIdentity", () => {
  it("mappingKey name com nome de uma palavra projeta identidade", () => {
    expect(project("name", "Ana")).toEqual({
      field: "name",
      patch: { displayName: "Ana", normalizedName: "ana" },
    })
  })

  it("e-mail usado como nome não projeta identidade", () => {
    expect(project("name", "ana@gmail.com")).toBeNull()
  })

  it("celular e fixo brasileiros projetam telefone", () => {
    expect(project("phone", "(11) 98888-7777")).toMatchObject({ field: "phone" })
    expect(project("phone", "(11) 3888-7777")).toMatchObject({ field: "phone" })
  })

  it("telefone inválido não projeta identidade", () => {
    expect(project("phone", "123")).toBeNull()
  })

  it("e-mail válido projeta o valor normalizado", () => {
    expect(project("email", "Ana@Gmail.com")).toEqual({
      field: "email",
      patch: { primaryEmail: "Ana@Gmail.com", normalizedPrimaryEmail: "ana@gmail.com" },
    })
  })

  it("mappingKey ausente ou não identitário nunca projeta", () => {
    expect(project(null, "Ana")).toBeNull()
    expect(project("plano", "familiar")).toBeNull()
  })

  it("valores não textuais e vazios não projetam identidade", () => {
    expect(project("name", ["Ana"])).toBeNull()
    expect(project("name", "   ")).toBeNull()
    expect(project("email", null)).toBeNull()
  })
})
