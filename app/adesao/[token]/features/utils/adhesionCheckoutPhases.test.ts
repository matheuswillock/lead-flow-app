import { describe, expect, it } from "bun:test"

import {
  adhesionPhasesFor,
  fieldElementId,
  firstInvalidFieldInPhase,
  phaseIndexOfField,
} from "./adhesionCheckoutPhases"
import { validateAdhesionPaymentForm, type AdhesionPaymentFormValues } from "./adhesionPaymentForm"

const VALID: AdhesionPaymentFormValues = {
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "(11) 99999-8888",
  postalCode: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  complement: "",
  city: "",
  state: "",
  installments: 1,
}

describe("adhesionPhasesFor", () => {
  it("PIX do Abacate: só os dados do representante", () => {
    expect(adhesionPhasesFor({ isCard: false, hasCardForm: false, needsAddress: false })).toEqual([
      "payer",
    ])
  })

  it("PIX legado do Asaas: dados e endereço", () => {
    expect(adhesionPhasesFor({ isCard: false, hasCardForm: false, needsAddress: true })).toEqual([
      "payer",
      "address",
    ])
  })

  it("cartão com formulário seguro: dados e dados do cartão, sem endereço", () => {
    expect(adhesionPhasesFor({ isCard: true, hasCardForm: true, needsAddress: false })).toEqual([
      "payer",
      "card",
    ])
  })
})

describe("firstInvalidFieldInPhase", () => {
  it("ignora erros de endereço ao validar a fase dos dados", () => {
    const errors = validateAdhesionPaymentForm(VALID, { needsAddress: true })

    expect(firstInvalidFieldInPhase(errors, "payer")).toBeNull()
    expect(firstInvalidFieldInPhase(errors, "address")).toBe("postalCode")
  })

  it("devolve o primeiro campo inválido na ordem visual da fase", () => {
    const errors = validateAdhesionPaymentForm(
      { ...VALID, email: "sem-arroba", fullName: "M" },
      { needsAddress: false },
    )

    expect(firstInvalidFieldInPhase(errors, "payer")).toBe("fullName")
  })
})

describe("phaseIndexOfField", () => {
  it("encontra a fase do campo ou -1 quando a forma não tem essa fase", () => {
    expect(phaseIndexOfField(["payer", "address"], "postalCode")).toBe(1)
    expect(phaseIndexOfField(["payer"], "postalCode")).toBe(-1)
    expect(phaseIndexOfField(["payer", "card"], "email")).toBe(0)
  })
})

describe("fieldElementId", () => {
  it("aponta para o input com o mesmo id do TextField", () => {
    expect(fieldElementId("addressNumber")).toBe("adhesion-addressNumber")
  })
})
