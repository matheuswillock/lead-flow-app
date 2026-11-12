import { describe, expect, it } from "bun:test"
import {
  firstInvalidAdhesionField,
  initialAdhesionPaymentValues,
  validateAdhesionPaymentForm,
} from "./adhesionPaymentForm"

const base = initialAdhesionPaymentValues({
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "(11) 99999-8888",
})

describe("validateAdhesionPaymentForm", () => {
  it("sem endereço exige só os dados do representante", () => {
    expect(validateAdhesionPaymentForm(base, { needsAddress: false })).toEqual({})
    const invalid = validateAdhesionPaymentForm(
      { ...base, fullName: "", email: "x", phone: "1" },
      { needsAddress: false },
    )
    expect(Object.keys(invalid)).toEqual(["fullName", "email", "phone"])
  })

  it("sem o representante (já validado na tela), não repete os erros dele", () => {
    const errors = validateAdhesionPaymentForm(
      { ...base, fullName: "", email: "" },
      { needsAddress: false, includePayer: false },
    )
    expect(errors).toEqual({})
  })

  it("com endereço (PIX legado do Asaas), exige o endereço completo", () => {
    const errors = validateAdhesionPaymentForm(base, { needsAddress: true })
    expect(errors.postalCode).toBeDefined()
    expect(firstInvalidAdhesionField(errors)).toBe("postalCode")

    const valid = validateAdhesionPaymentForm(
      {
        ...base,
        postalCode: "01310-100",
        address: "Avenida Paulista",
        addressNumber: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
      },
      { needsAddress: true },
    )
    expect(valid).toEqual({})
  })
})
