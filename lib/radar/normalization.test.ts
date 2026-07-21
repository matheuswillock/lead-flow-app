import { describe, expect, test } from "bun:test"
import {
  formatDisplayPhone,
  isValidRadarPrimaryIdentity,
  normalizeRadarDocument,
  normalizeRadarEmail,
  normalizeRadarName,
  normalizeRadarPhone,
} from "./normalization"

describe("normalizeRadarPhone", () => {
  test("normaliza telefone brasileiro com DDD", () => {
    expect(normalizeRadarPhone("(11) 99999-9999")).toBe("5511999999999")
  })

  test("mantém telefone já com código do país", () => {
    expect(normalizeRadarPhone("+55 11 99999-9999")).toBe("5511999999999")
  })
})

describe("normalizeRadarName", () => {
  test("remove acentos e colapsa espaços", () => {
    expect(normalizeRadarName("  João   da Silva  ")).toBe("joao da silva")
  })
})

describe("normalizeRadarEmail", () => {
  test("lowercase e trim", () => {
    expect(normalizeRadarEmail("  Maria@Example.COM ")).toBe("maria@example.com")
  })
})

describe("normalizeRadarDocument", () => {
  test("mantém somente dígitos", () => {
    expect(normalizeRadarDocument("12.345.678/0001-99")).toBe("12345678000199")
  })
})

describe("isValidRadarPrimaryIdentity", () => {
  test("exige telefone válido e nome", () => {
    expect(isValidRadarPrimaryIdentity("11999999999", "Maria")).toBe(true)
    expect(isValidRadarPrimaryIdentity("", "Maria")).toBe(false)
    expect(isValidRadarPrimaryIdentity("11999999999", "")).toBe(false)
  })
})

describe("formatDisplayPhone", () => {
  test("formata celular brasileiro", () => {
    expect(formatDisplayPhone("11999999999")).toBe("(11) 99999-9999")
  })
})
