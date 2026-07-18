import { describe, expect, it } from "bun:test"
import { maskPhone, normalizeLeadPhoneDigits } from "@/lib/masks"

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
