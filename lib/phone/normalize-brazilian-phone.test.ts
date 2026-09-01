import { describe, expect, it } from "bun:test"
import {
  isBrazilianContactPhoneDigits,
  isBrazilianLandlinePhoneDigits,
  isBrazilianMobilePhoneDigits,
  normalizeBrazilianPhoneDigits,
  stripBrazilCountryCode,
} from "./normalize-brazilian-phone"

describe("stripBrazilCountryCode", () => {
  it("remove o DDI 55 de um fixo SP de 12 dígitos (caso GERSON)", () => {
    expect(stripBrazilCountryCode("551124222006")).toBe("1124222006")
  })

  it("remove o DDI 55 de um celular de 13 dígitos", () => {
    expect(stripBrazilCountryCode("5511982308088")).toBe("11982308088")
  })

  it("nunca altera um celular gaúcho legítimo com DDD 55 (11 dígitos)", () => {
    expect(stripBrazilCountryCode("55996326534")).toBe("55996326534")
  })

  it("nunca altera um fixo gaúcho legítimo com DDD 55 (10 dígitos)", () => {
    expect(stripBrazilCountryCode("5532611122")).toBe("5532611122")
  })

  it("mantém intacto um valor que não forma telefone válido nem com nem sem o prefixo", () => {
    // (55) 19118-0656 truncado pela máscara antiga — 11 dígitos, local inválido
    // com ou sem o "55": o backend não inventa dígito, só recusa.
    expect(stripBrazilCountryCode("55191180656")).toBe("55191180656")
  })

  it("não mexe em dígitos que não começam com 55", () => {
    expect(stripBrazilCountryCode("11988887777")).toBe("11988887777")
  })

  it("é idempotente para telefones já normalizados", () => {
    const already = "11988887777"
    expect(stripBrazilCountryCode(stripBrazilCountryCode(already))).toBe(already)
  })

  it("é idempotente para telefones que perderam o prefixo", () => {
    const withCountryCode = "551124222006"
    const once = stripBrazilCountryCode(withCountryCode)
    expect(stripBrazilCountryCode(once)).toBe(once)
  })
})

describe("normalizeBrazilianPhoneDigits", () => {
  it("remove máscara e código do país de '55 11 2422-2006'", () => {
    expect(normalizeBrazilianPhoneDigits("55 11 2422-2006")).toBe("1124222006")
  })

  it("remove máscara e código do país de '5511242220 06' (12 dígitos)", () => {
    expect(normalizeBrazilianPhoneDigits("5511242220 06")).toBe("1124222006")
  })

  it("remove máscara e código do país de '+55 (11) 98230-8088'", () => {
    expect(normalizeBrazilianPhoneDigits("+55 (11) 98230-8088")).toBe("11982308088")
  })

  it("mantém intacto um celular gaúcho legítimo '(55) 99632-6534'", () => {
    expect(normalizeBrazilianPhoneDigits("(55) 99632-6534")).toBe("55996326534")
  })

  it("mantém intacto um fixo gaúcho legítimo '55 3261-1122'", () => {
    expect(normalizeBrazilianPhoneDigits("55 3261-1122")).toBe("5532611122")
  })

  it("mantém intacto (e reprovável na régua) '(55) 19118-0656'", () => {
    const result = normalizeBrazilianPhoneDigits("(55) 19118-0656")
    expect(result).toBe("55191180656")
    expect(isBrazilianContactPhoneDigits(result)).toBe(false)
  })

  it("é idempotente ao ser aplicada duas vezes sobre o mesmo valor bruto", () => {
    const raw = "+55 (11) 98230-8088"
    const once = normalizeBrazilianPhoneDigits(raw)
    expect(normalizeBrazilianPhoneDigits(once)).toBe(once)
  })
})

describe("isBrazilianMobilePhoneDigits / isBrazilianLandlinePhoneDigits / isBrazilianContactPhoneDigits", () => {
  it("classifica celular BR (11 dígitos, terceiro dígito 9)", () => {
    expect(isBrazilianMobilePhoneDigits("11988887777")).toBe(true)
    expect(isBrazilianLandlinePhoneDigits("11988887777")).toBe(false)
    expect(isBrazilianContactPhoneDigits("11988887777")).toBe(true)
  })

  it("classifica fixo BR (10 dígitos, terceiro dígito 2-5)", () => {
    expect(isBrazilianLandlinePhoneDigits("1138971122")).toBe(true)
    expect(isBrazilianMobilePhoneDigits("1138971122")).toBe(false)
    expect(isBrazilianContactPhoneDigits("1138971122")).toBe(true)
  })

  it("recusa número truncado (9 dígitos, celular sem o último dígito)", () => {
    expect(isBrazilianContactPhoneDigits("1198887777")).toBe(false)
  })
})
