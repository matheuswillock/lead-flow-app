import { describe, expect, it } from "bun:test"

import { errorsForPhase, phaseIndexForField } from "@/components/checkout/checkoutPhases"
import type { PublicCheckoutPayerPrefill } from "./publicCheckoutTypes"
import { PUBLIC_CHECKOUT_PHASES, firstPaymentField, validatePaymentForm } from "./publicCheckoutPhases"

const valid: PublicCheckoutPayerPrefill = {
  fullName: "Maria Souza",
  email: "maria@example.com",
  phone: "11999998888",
  cpfCnpj: "52998224725",
  postalCode: "01310100",
  address: "Avenida Paulista",
  addressNumber: "1000",
  neighborhood: "Bela Vista",
  complement: "",
  city: "São Paulo",
  state: "SP",
}

describe("validatePaymentForm", () => {
  it("não aponta erro quando os dados são válidos e o endereço é resolvido", () => {
    expect(validatePaymentForm(valid, { requiresAddress: true, cepResolved: true })).toEqual({})
  })

  it("ignora endereço quando o fluxo não exige (PIX do Abacate)", () => {
    const withoutAddress = { ...valid, postalCode: "", address: "", addressNumber: "", neighborhood: "", city: "", state: "" }
    expect(validatePaymentForm(withoutAddress, { requiresAddress: false, cepResolved: false })).toEqual({})
  })

  it("aponta o campo do pagador inválido com mensagem em PT-BR", () => {
    const errors = validatePaymentForm({ ...valid, email: "maria@", phone: "119" }, { requiresAddress: true, cepResolved: true })
    expect(errors.email).toBe("Informe um e-mail válido.")
    expect(errors.phone).toBe("Informe um telefone com DDD.")
  })

  it("exige CEP resolvido antes de aceitar o endereço", () => {
    const errors = validatePaymentForm(valid, { requiresAddress: true, cepResolved: false })
    expect(errors.postalCode).toBe("Não encontramos este CEP.")
  })
})

describe("roteamento de erros pelas fases do checkout", () => {
  it("o primeiro erro indica a fase Pagamento, nunca o Resumo", () => {
    const errors = validatePaymentForm({ ...valid, cpfCnpj: "123" }, { requiresAddress: true, cepResolved: true })
    const field = firstPaymentField(errors)

    expect(field).toBe("cpfCnpj")
    expect(phaseIndexForField(PUBLIC_CHECKOUT_PHASES, field!)).toBe(1)
  })

  it("Continuar na fase Resumo não bloqueia por erros da fase Pagamento", () => {
    const errors = validatePaymentForm({ ...valid, fullName: "" }, { requiresAddress: true, cepResolved: true })
    expect(errorsForPhase(PUBLIC_CHECKOUT_PHASES[0], errors)).toEqual({})
    expect(errorsForPhase(PUBLIC_CHECKOUT_PHASES[1], errors)).toEqual({ fullName: "Informe seu nome completo." })
  })

  it("não há campo com erro quando o formulário está válido", () => {
    expect(firstPaymentField({})).toBeNull()
  })
})
