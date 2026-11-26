import { describe, expect, it } from "bun:test"
import { applyPhoneInput, isLandlinePhone, maskPhone, normalizeLeadPhoneDigits } from "@/lib/masks"

describe("isLandlinePhone", () => {
  it("reconhece telefone fixo: DDD + 8 dígitos começando de 2 a 5", () => {
    expect(isLandlinePhone("(11) 3456-7890")).toBe(true)
    expect(isLandlinePhone("1134567890")).toBe(true)
    expect(isLandlinePhone("+55 21 2345-6789")).toBe(true)
    expect(isLandlinePhone("5511345678901".slice(0, 12))).toBe(true)
  })

  it("celular com 9 dígitos não é fixo", () => {
    expect(isLandlinePhone("(11) 99999-9999")).toBe(false)
    expect(isLandlinePhone("5511999999999")).toBe(false)
  })

  it("número de 8 dígitos começando em 6 a 9 (celular antigo) não gera aviso", () => {
    expect(isLandlinePhone("1188887777")).toBe(false)
  })

  it("vazio ou incompleto não é fixo", () => {
    expect(isLandlinePhone("")).toBe(false)
    expect(isLandlinePhone("11345")).toBe(false)
  })
})

describe("normalizeLeadPhoneDigits", () => {
  it("mantém DDD + número com até 11 dígitos", () => {
    expect(normalizeLeadPhoneDigits("(11) 99999-9999")).toBe("11999999999")
    expect(normalizeLeadPhoneDigits("1199999999")).toBe("1199999999")
  })

  it("remove DDI 55 e mantém a partir do DDD", () => {
    expect(normalizeLeadPhoneDigits("55 11 99999-9999")).toBe("11999999999")
    expect(normalizeLeadPhoneDigits("5511999999999")).toBe("11999999999")
    expect(normalizeLeadPhoneDigits("+55 11 99999-9999")).toBe("11999999999")
    expect(normalizeLeadPhoneDigits("5521973960888")).toBe("21973960888")
  })

  it("remove DDI 55 de fixo E.164 com 12 dígitos", () => {
    expect(normalizeLeadPhoneDigits("+55 11 3333-4444")).toBe("1133334444")
    expect(normalizeLeadPhoneDigits("551133334444")).toBe("1133334444")
  })

  it("retorna vazio para valor vazio", () => {
    expect(normalizeLeadPhoneDigits("")).toBe("")
  })
})

describe("maskPhone", () => {
  it("mascara removendo DDI quando presente", () => {
    expect(maskPhone("5511999999999")).toBe("(11) 99999-9999")
    expect(maskPhone("55 11 99999-9999")).toBe("(11) 99999-9999")
    expect(maskPhone("5521973960888")).toBe("(21) 97396-0888")
    expect(maskPhone("+55 11 3333-4444")).toBe("(11) 3333-4444")
  })
})

describe("applyPhoneInput", () => {
  it("digitar o 12º dígito não troca o DDD: o número completo fica como está", () => {
    // Sem a trava, maskPhone("(11) 99999-88887") devolve "(19) 99998-8887".
    expect(applyPhoneInput("11999998888", "(11) 99999-88887", true)).toBe("11999998888")
  })

  it("DDD 55 também fica protegido ao digitar além do limite", () => {
    expect(applyPhoneInput("55999998888", "(55) 99999-88887", true)).toBe("55999998888")
  })

  it("colar com +55 continua normalizando para o número nacional", () => {
    expect(applyPhoneInput("", "+55 (11) 99999-8888", false)).toBe("11999998888")
    expect(applyPhoneInput("11999998888", "5521973960888", false)).toBe("21973960888")
  })

  it("digitar dentro do limite segue normal, inclusive apagar", () => {
    expect(applyPhoneInput("1199999888", "(11) 99999-8888", true)).toBe("11999998888")
    expect(applyPhoneInput("11999998888", "(11) 99999-888", true)).toBe("1199999888")
    expect(applyPhoneInput("11999998888", "", true)).toBe("")
  })
})
