import { describe, expect, it } from "bun:test"
import {
  getPhoneFieldInlineError,
  isValidPhoneFieldValue,
  normalizeAndMaskPhoneInput,
  PHONE_FIELD_INLINE_ERROR_MESSAGE,
  shouldBlockFirstPhoneSubmitAttempt,
} from "./phone-field"

describe("normalizeAndMaskPhoneInput", () => {
  it("T-41.5c: remove +55 digitado antes do DDD e mascara o restante (caso GERSON/KKJ)", () => {
    expect(normalizeAndMaskPhoneInput("+55 11 2422-2006")).toBe("(11) 2422-2006")
  })

  it("remove 55 colado sem o + (13 dígitos colados de uma vez)", () => {
    expect(normalizeAndMaskPhoneInput("5511982308088")).toBe("(11) 98230-8088")
  })

  it("NUNCA altera celular legítimo com DDD 55 (Rio Grande do Sul)", () => {
    expect(normalizeAndMaskPhoneInput("(55) 99632-6534")).toBe("(55) 99632-6534")
  })

  it("controle: DDD 55 duplicado sem número BR válido embutido não normaliza (T-F1.7 espelhado)", () => {
    expect(normalizeAndMaskPhoneInput("(55) 19118-0656")).toBe("(55) 19118-0656")
  })

  it("não mexe em digitação parcial curta", () => {
    expect(normalizeAndMaskPhoneInput("55")).toBe("(55")
  })
})

describe("normalizeAndMaskPhoneInput — digitação incremental (valor exibido realimentado a cada tecla)", () => {
  /**
   * O campo é controlado: a cada tecla o valor JÁ mascarado volta pela cadeia
   * com o dígito novo no fim. Sem a regra tolerante a digitação em andamento,
   * aos 12 dígitos o resto de 10 ainda não é um telefone válido, o strip por
   * validade não dispara, e a máscara corta de volta para 11 — o 12º dígito é
   * engolido a cada tecla e o 13º nunca acumula (caso Nathany, celular com DDI).
   */
  function typeDigitByDigit(digits: string): string {
    let value = ""
    for (const digit of digits) {
      value = normalizeAndMaskPhoneInput(value + digit)
    }
    return value
  }

  it("fixo com DDI digitado tecla a tecla (12 díg., caso GERSON) → (11) 2422-2006", () => {
    expect(typeDigitByDigit("551124222006")).toBe("(11) 2422-2006")
  })

  it("celular com DDI digitado tecla a tecla (13 díg., caso Nathany) → (11) 98230-8088", () => {
    expect(typeDigitByDigit("5511982308088")).toBe("(11) 98230-8088")
  })

  it("celular RS com DDI digitado tecla a tecla (13 díg.) → (55) 99632-6534", () => {
    expect(typeDigitByDigit("5555996326534")).toBe("(55) 99632-6534")
  })

  it("celular RS local digitado tecla a tecla (11 díg.) → intocado", () => {
    expect(typeDigitByDigit("55996326534")).toBe("(55) 99632-6534")
  })
})

describe("isValidPhoneFieldValue", () => {
  it("aceita vazio (obrigatoriedade é responsabilidade de validateAnswer)", () => {
    expect(isValidPhoneFieldValue("")).toBe(true)
    expect(isValidPhoneFieldValue(undefined)).toBe(true)
  })

  it("aceita fixo BR válido", () => {
    expect(isValidPhoneFieldValue("(11) 2422-2006")).toBe(true)
  })

  it("aceita celular BR válido com DDD 55", () => {
    expect(isValidPhoneFieldValue("(55) 99632-6534")).toBe(true)
  })

  it("rejeita o valor truncado real do caso GERSON — (55) vira DDD e parte local é impossível", () => {
    expect(isValidPhoneFieldValue("(55) 11242-2006")).toBe(false)
  })

  it("rejeita o controle de colagem duplicada", () => {
    expect(isValidPhoneFieldValue("(55) 19118-0656")).toBe(false)
  })
})

describe("getPhoneFieldInlineError", () => {
  it("retorna null para telefone válido", () => {
    expect(getPhoneFieldInlineError("(11) 91234-5678")).toBeNull()
  })

  it("retorna a mensagem de erro para telefone inválido", () => {
    expect(getPhoneFieldInlineError("(55) 11242-2006")).toBe(PHONE_FIELD_INLINE_ERROR_MESSAGE)
  })
})

describe("shouldBlockFirstPhoneSubmitAttempt", () => {
  it("T-41.5b: bloqueia o primeiro submit quando o telefone é inválido", () => {
    expect(
      shouldBlockFirstPhoneSubmitAttempt({ value: "(55) 11242-2006", alreadyWarnedOnce: false }),
    ).toBe(true)
  })

  it("libera o segundo submit mesmo que o telefone continue inválido (régua de lead != régua de envio)", () => {
    expect(
      shouldBlockFirstPhoneSubmitAttempt({ value: "(55) 11242-2006", alreadyWarnedOnce: true }),
    ).toBe(false)
  })

  it("nunca bloqueia quando o telefone já é válido", () => {
    expect(
      shouldBlockFirstPhoneSubmitAttempt({ value: "(11) 91234-5678", alreadyWarnedOnce: false }),
    ).toBe(false)
  })
})
