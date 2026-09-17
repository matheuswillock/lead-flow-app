import { describe, expect, it } from "bun:test"
import {
  formatBrazilianCurrency,
  formatCurrencyStateForDisplay,
  normalizeCurrencyState,
  parseBrazilianCurrency,
} from "./currencyInput"

describe("parseBrazilianCurrency", () => {
  describe("formato brasileiro", () => {
    it("interpreta ponto de milhar antes da vírgula", () => {
      expect(parseBrazilianCurrency("12.345,67")).toBe(12345.67)
    })

    it("interpreta vírgula decimal sem milhar", () => {
      expect(parseBrazilianCurrency("12345,67")).toBe(12345.67)
    })

    it("interpreta milhar simples", () => {
      expect(parseBrazilianCurrency("1.234,56")).toBe(1234.56)
    })

    it("interpreta valor pequeno com vírgula", () => {
      expect(parseBrazilianCurrency("12,35")).toBe(12.35)
    })

    it("aceita fração de 1 dígito", () => {
      expect(parseBrazilianCurrency("0,5")).toBe(0.5)
    })

    it("rejeita fração com mais de 2 dígitos (review #1102: 1,234 divergia entre tela e banco)", () => {
      expect(parseBrazilianCurrency("1,234")).toBeNull()
      expect(parseBrazilianCurrency("2.500,123")).toBeNull()
    })

    it("rejeita agrupamento de milhar inválido antes da vírgula", () => {
      expect(parseBrazilianCurrency("12.34,56")).toBeNull()
    })

    it("entrada de fração inválida fica crua no state para a validação bloquear", () => {
      expect(normalizeCurrencyState("1,234")).toBe("1,234")
    })

    it("ignora o prefixo R$", () => {
      expect(parseBrazilianCurrency("R$ 12.345,67")).toBe(12345.67)
    })

    it("interpreta milhar redondo com centavos zerados", () => {
      expect(parseBrazilianCurrency("10.000,00")).toBe(10000)
    })

    it("interpreta milhar sem vírgula como agrupamento", () => {
      expect(parseBrazilianCurrency("10.000")).toBe(10000)
    })

    it("interpreta múltiplos grupos de milhar sem vírgula", () => {
      expect(parseBrazilianCurrency("1.234.567")).toBe(1234567)
    })
  })

  describe("formato canônico do form state (hidratação de edição)", () => {
    it("interpreta decimal US com duas casas", () => {
      expect(parseBrazilianCurrency("123.45")).toBe(123.45)
    })

    it("interpreta decimal US com uma casa", () => {
      expect(parseBrazilianCurrency("123.4")).toBe(123.4)
    })

    it("interpreta inteiro sem separador", () => {
      expect(parseBrazilianCurrency("10000")).toBe(10000)
    })
  })

  describe("entradas inválidas", () => {
    it("rejeita string vazia", () => {
      expect(parseBrazilianCurrency("")).toBeNull()
    })

    it("rejeita texto não numérico", () => {
      expect(parseBrazilianCurrency("abc")).toBeNull()
    })

    it("rejeita múltiplas vírgulas", () => {
      expect(parseBrazilianCurrency("12,34,56")).toBeNull()
    })

    it("rejeita só símbolos", () => {
      expect(parseBrazilianCurrency("R$ ,.")).toBeNull()
    })
  })
})

describe("formatBrazilianCurrency", () => {
  it("formata em padrão brasileiro com milhar e centavos", () => {
    expect(formatBrazilianCurrency(12345.67)).toBe("R$ 12.345,67")
  })

  it("faz round-trip parse(format(n)) === n", () => {
    for (const value of [12345.67, 10000, 1234.56, 12.35, 0.99]) {
      expect(parseBrazilianCurrency(formatBrazilianCurrency(value))).toBe(value)
    }
  })
})

describe("normalizeCurrencyState", () => {
  it("converte digitação brasileira para o estado canônico", () => {
    expect(normalizeCurrencyState("12.345,67")).toBe("12345.67")
  })

  it("mantém o estado canônico da hidratação", () => {
    expect(normalizeCurrencyState("123.45")).toBe("123.45")
  })

  it("devolve vazio para entrada vazia", () => {
    expect(normalizeCurrencyState("")).toBe("")
    expect(normalizeCurrencyState("   ")).toBe("")
  })

  it("mantém entrada inválida crua para a validação rejeitar", () => {
    expect(normalizeCurrencyState("abc")).toBe("abc")
  })
})

describe("formatCurrencyStateForDisplay", () => {
  it("formata o estado canônico para exibição", () => {
    expect(formatCurrencyStateForDisplay("12345.67")).toBe("R$ 12.345,67")
  })

  it("formata inteiro canônico com centavos", () => {
    expect(formatCurrencyStateForDisplay("10000")).toBe("R$ 10.000,00")
  })

  it("devolve vazio para estado vazio", () => {
    expect(formatCurrencyStateForDisplay("")).toBe("")
  })

  it("devolve o cru quando não parseia", () => {
    expect(formatCurrencyStateForDisplay("abc")).toBe("abc")
  })
})
