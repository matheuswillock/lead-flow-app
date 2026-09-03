import { describe, expect, it } from "bun:test"
import {
  resolvePrefilledFieldIds,
  retainPrefilledFieldsWithAnswers,
  withoutPrefilledField,
} from "./prefill-indicator"

describe("resolvePrefilledFieldIds", () => {
  it("marca a pergunta de nome quando o prefill a preenche e ela ainda está vazia", () => {
    const ids = resolvePrefilledFieldIds({
      questions: [{ id: "q-name", mappingKey: "name" }],
      prefill: { name: "ED-ENERGY", email: null },
      currentAnswers: {},
    })

    expect(ids.has("q-name")).toBe(true)
  })

  it("marca nome e e-mail juntos quando ambos vêm do prefill", () => {
    const ids = resolvePrefilledFieldIds({
      questions: [
        { id: "q-name", mappingKey: "name" },
        { id: "q-email", mappingKey: "email" },
      ],
      prefill: { name: "ED-ENERGY", email: "contato@ed-energy.com" },
      currentAnswers: {},
    })

    expect([...ids].sort()).toEqual(["q-email", "q-name"])
  })

  it("não marca campo que o visitante já respondeu antes do prefill chegar", () => {
    const ids = resolvePrefilledFieldIds({
      questions: [{ id: "q-name", mappingKey: "name" }],
      prefill: { name: "ED-ENERGY", email: null },
      currentAnswers: { "q-name": "Maria Silva" },
    })

    expect(ids.has("q-name")).toBe(false)
  })

  it("nunca marca pergunta sem mappingKey de nome/e-mail, mesmo com prefill disponível", () => {
    const ids = resolvePrefilledFieldIds({
      questions: [{ id: "q-vidas", mappingKey: null }],
      prefill: { name: "ED-ENERGY", email: "contato@ed-energy.com" },
      currentAnswers: {},
    })

    expect(ids.size).toBe(0)
  })

  it("não marca quando o prefill não trouxe valor para o mapeamento", () => {
    const ids = resolvePrefilledFieldIds({
      questions: [{ id: "q-email", mappingKey: "email" }],
      prefill: { name: null, email: null },
      currentAnswers: {},
    })

    expect(ids.size).toBe(0)
  })
})

describe("withoutPrefilledField", () => {
  it("remove o campo editado do conjunto de prefill", () => {
    const next = withoutPrefilledField(new Set(["q-name", "q-email"]), "q-name")

    expect([...next]).toEqual(["q-email"])
  })

  it("mantém os demais campos prefillados intactos — edição é por campo", () => {
    const next = withoutPrefilledField(new Set(["q-name", "q-email"]), "q-name")

    expect(next.has("q-email")).toBe(true)
  })

  it("é inofensivo quando o campo editado nunca esteve marcado", () => {
    const next = withoutPrefilledField(new Set(["q-email"]), "q-phone")

    expect([...next]).toEqual(["q-email"])
  })

  it("retorna um Set novo, sem mutar o conjunto original", () => {
    const original = new Set(["q-name"])
    const next = withoutPrefilledField(original, "q-name")

    expect(original.has("q-name")).toBe(true)
    expect(next.has("q-name")).toBe(false)
  })
})

describe("retainPrefilledFieldsWithAnswers", () => {
  it("remove do conjunto a pergunta cuja resposta foi podada pela lógica condicional", () => {
    const next = retainPrefilledFieldsWithAnswers(new Set(["q-name", "q-email"]), {
      "q-email": "contato@ed-energy.com",
    })

    expect([...next]).toEqual(["q-email"])
  })

  it("mantém o conjunto intacto (mesma referência) quando todas as respostas seguem presentes", () => {
    const original = new Set(["q-name"])
    const next = retainPrefilledFieldsWithAnswers(original, { "q-name": "ED-ENERGY" })

    expect(next).toBe(original)
  })

  it("esvazia o conjunto quando todas as respostas prefilladas foram podadas", () => {
    const next = retainPrefilledFieldsWithAnswers(new Set(["q-name", "q-email"]), {})

    expect(next.size).toBe(0)
  })

  it("não muta o conjunto original ao podar", () => {
    const original = new Set(["q-name", "q-email"])
    retainPrefilledFieldsWithAnswers(original, { "q-email": "contato@ed-energy.com" })

    expect([...original].sort()).toEqual(["q-email", "q-name"])
  })
})
