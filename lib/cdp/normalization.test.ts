import { describe, expect, test } from "bun:test"
import {
  formatDisplayPhone,
  isValidCdpPrimaryIdentity,
  normalizeCdpDocument,
  normalizeCdpEmail,
  normalizeCdpName,
  normalizeCdpPhone,
} from "./normalization"

describe("normalizeCdpPhone", () => {
  test("normaliza telefone brasileiro com DDD", () => {
    expect(normalizeCdpPhone("(11) 99999-9999")).toBe("5511999999999")
  })

  test("mantém telefone já com código do país", () => {
    expect(normalizeCdpPhone("+55 11 99999-9999")).toBe("5511999999999")
  })
})

describe("normalizeCdpName", () => {
  test("remove acentos e colapsa espaços", () => {
    expect(normalizeCdpName("  João   da Silva  ")).toBe("joao da silva")
  })
})

describe("normalizeCdpEmail", () => {
  test("lowercase e trim", () => {
    expect(normalizeCdpEmail("  Maria@Example.COM ")).toBe("maria@example.com")
  })
})

describe("normalizeCdpDocument", () => {
  test("mantém somente dígitos", () => {
    expect(normalizeCdpDocument("12.345.678/0001-99")).toBe("12345678000199")
  })
})

describe("isValidCdpPrimaryIdentity", () => {
  test("exige telefone válido e nome", () => {
    expect(isValidCdpPrimaryIdentity("11999999999", "Maria")).toBe(true)
    expect(isValidCdpPrimaryIdentity("", "Maria")).toBe(false)
    expect(isValidCdpPrimaryIdentity("11999999999", "")).toBe(false)
  })
})

describe("formatDisplayPhone", () => {
  test("formata celular brasileiro", () => {
    expect(formatDisplayPhone("11999999999")).toBe("(11) 99999-9999")
  })
})
