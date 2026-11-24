import { describe, expect, it } from "bun:test"
import {
  clampPhaseIndex,
  errorsForPhase,
  nextPhaseIndex,
  phaseIndexForField,
  previousPhaseIndex,
  type CheckoutPhase,
} from "./checkoutPhases"

const phases: CheckoutPhase[] = [
  { label: "Período do plano", fields: ["cycle"] },
  { label: "Seus dados", fields: ["cnpj", "email"] },
  { label: "Dados do cartão", fields: [] },
]

describe("nextPhaseIndex", () => {
  it("avança uma fase", () => {
    expect(nextPhaseIndex(0, 3)).toBe(1)
  })

  it("fica na última fase quando já está nela", () => {
    expect(nextPhaseIndex(2, 3)).toBe(2)
  })
})

describe("previousPhaseIndex", () => {
  it("volta uma fase", () => {
    expect(previousPhaseIndex(2)).toBe(1)
  })

  it("fica na primeira fase quando já está nela", () => {
    expect(previousPhaseIndex(0)).toBe(0)
  })
})

describe("clampPhaseIndex", () => {
  it("mantém a fase quando ela ainda existe", () => {
    expect(clampPhaseIndex(1, 3)).toBe(1)
  })

  it("leva à última fase válida quando a lista encolhe", () => {
    expect(clampPhaseIndex(2, 2)).toBe(1)
  })

  it("nunca fica abaixo de zero", () => {
    expect(clampPhaseIndex(-1, 3)).toBe(0)
    expect(clampPhaseIndex(0, 0)).toBe(0)
  })
})

describe("phaseIndexForField", () => {
  it("devolve a fase que contém o campo", () => {
    expect(phaseIndexForField(phases, "email")).toBe(1)
    expect(phaseIndexForField(phases, "cycle")).toBe(0)
  })

  it("devolve -1 para campo fora de qualquer fase (ex.: termos na lateral)", () => {
    expect(phaseIndexForField(phases, "termsAccepted")).toBe(-1)
  })
})

describe("errorsForPhase", () => {
  it("filtra só os erros dos campos da fase", () => {
    const errors = { cnpj: "CNPJ inválido", cycle: "Selecione um plano" }
    expect(errorsForPhase(phases[1], errors)).toEqual({ cnpj: "CNPJ inválido" })
  })

  it("não devolve erros quando a fase não tem campos com erro", () => {
    expect(errorsForPhase(phases[1], { termsAccepted: "Aceite os termos" })).toEqual({})
  })
})
