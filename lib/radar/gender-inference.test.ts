import { describe, expect, test } from "bun:test"
import { inferGenderFromSocios } from "./gender-inference"

describe("inferGenderFromSocios", () => {
  test("sócio único com nome presente no catálogo BR retorna gênero correto (masculino)", () => {
    expect(inferGenderFromSocios(["João da Silva"])).toBe("male")
  })

  test("sócio único com nome presente no catálogo BR retorna gênero correto (feminino)", () => {
    expect(inferGenderFromSocios("Maria Souza")).toBe("female")
  })

  test("múltiplos sócios com sinais conflitantes retorna unknown", () => {
    expect(inferGenderFromSocios(["João Pereira", "Maria Oliveira"])).toBe("unknown")
  })

  test("campo socios vazio retorna unknown", () => {
    expect(inferGenderFromSocios([])).toBe("unknown")
  })

  test("campo socios ausente retorna unknown", () => {
    expect(inferGenderFromSocios(null)).toBe("unknown")
    expect(inferGenderFromSocios(undefined)).toBe("unknown")
  })

  test("só iniciais retorna unknown", () => {
    expect(inferGenderFromSocios(["J. S."])).toBe("unknown")
    expect(inferGenderFromSocios(["M."])).toBe("unknown")
  })

  test("nunca infere a partir de razaoSocial — depende somente de socios", () => {
    const razaoSocialGenerificavel = "Maria Empreendimentos Ltda"
    void razaoSocialGenerificavel

    expect(inferGenderFromSocios([])).toBe("unknown")
    expect(inferGenderFromSocios(null)).toBe("unknown")
    expect(inferGenderFromSocios(["João Pereira"])).toBe("male")
  })

  test("nome fora do catálogo retorna unknown sem lançar exceção", () => {
    expect(() => inferGenderFromSocios(["Xylophonius Maximus"])).not.toThrow()
    expect(inferGenderFromSocios(["Xylophonius Maximus"])).toBe("unknown")
  })
})
