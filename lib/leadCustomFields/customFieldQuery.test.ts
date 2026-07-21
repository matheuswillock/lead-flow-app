import { describe, expect, it } from "bun:test"
import { buildCustomFieldWhereFilter, compareCustomFieldSortValues } from "./customFieldQuery"

const DEFINITION_ID = "11111111-1111-1111-1111-111111111111"

describe("buildCustomFieldWhereFilter", () => {
  describe("eq", () => {
    it("text", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "eq", value: "Ouro" })
      ).toEqual({
        customFieldValues: { some: { definitionId: DEFINITION_ID, value: { equals: "Ouro" } } },
      })
    })

    it("number", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "eq", value: 42 })
      ).toEqual({
        customFieldValues: { some: { definitionId: DEFINITION_ID, value: { equals: 42 } } },
      })
    })

    it("date", () => {
      expect(
        buildCustomFieldWhereFilter({
          definitionId: DEFINITION_ID,
          operator: "eq",
          value: "2026-01-01",
        })
      ).toEqual({
        customFieldValues: {
          some: { definitionId: DEFINITION_ID, value: { equals: "2026-01-01" } },
        },
      })
    })

    it("select", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "eq", value: "opcao_a" })
      ).toEqual({
        customFieldValues: {
          some: { definitionId: DEFINITION_ID, value: { equals: "opcao_a" } },
        },
      })
    })

    it("multi_select", () => {
      expect(
        buildCustomFieldWhereFilter({
          definitionId: DEFINITION_ID,
          operator: "eq",
          value: ["a", "b"],
        })
      ).toEqual({
        customFieldValues: {
          some: { definitionId: DEFINITION_ID, value: { equals: ["a", "b"] } },
        },
      })
    })

    it("boolean", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "eq", value: true })
      ).toEqual({
        customFieldValues: { some: { definitionId: DEFINITION_ID, value: { equals: true } } },
      })
    })
  })

  describe("neq", () => {
    it("nega eq (inclui leads sem valor para a definição)", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "neq", value: "Ouro" })
      ).toEqual({
        NOT: {
          customFieldValues: { some: { definitionId: DEFINITION_ID, value: { equals: "Ouro" } } },
        },
      })
    })

    it("number", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "neq", value: 10 })
      ).toEqual({
        NOT: {
          customFieldValues: { some: { definitionId: DEFINITION_ID, value: { equals: 10 } } },
        },
      })
    })

    it("boolean", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "neq", value: false })
      ).toEqual({
        NOT: {
          customFieldValues: { some: { definitionId: DEFINITION_ID, value: { equals: false } } },
        },
      })
    })
  })

  describe("contains", () => {
    it("text usa string_contains case-insensitive", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "contains", value: "our" })
      ).toEqual({
        customFieldValues: {
          some: {
            definitionId: DEFINITION_ID,
            value: { string_contains: "our", mode: "insensitive" },
          },
        },
      })
    })

    it("coerce valores não-string para string", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "contains", value: 42 })
      ).toEqual({
        customFieldValues: {
          some: {
            definitionId: DEFINITION_ID,
            value: { string_contains: "42", mode: "insensitive" },
          },
        },
      })
    })

    it("value ausente vira string vazia", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "contains" })
      ).toEqual({
        customFieldValues: {
          some: {
            definitionId: DEFINITION_ID,
            value: { string_contains: "", mode: "insensitive" },
          },
        },
      })
    })
  })

  describe("is_empty", () => {
    it("usa none independente do tipo", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "is_empty" })
      ).toEqual({
        customFieldValues: { none: { definitionId: DEFINITION_ID } },
      })
    })
  })

  describe("not_empty", () => {
    it("usa some independente do tipo", () => {
      expect(
        buildCustomFieldWhereFilter({ definitionId: DEFINITION_ID, operator: "not_empty" })
      ).toEqual({
        customFieldValues: { some: { definitionId: DEFINITION_ID } },
      })
    })
  })
})

describe("compareCustomFieldSortValues", () => {
  it("ordena números crescente", () => {
    expect(compareCustomFieldSortValues(1, 2, "asc")).toBeLessThan(0)
    expect(compareCustomFieldSortValues(2, 1, "asc")).toBeGreaterThan(0)
    expect(compareCustomFieldSortValues(5, 5, "asc")).toBe(0)
  })

  it("ordena números decrescente", () => {
    expect(compareCustomFieldSortValues(1, 2, "desc")).toBeGreaterThan(0)
    expect(compareCustomFieldSortValues(2, 1, "desc")).toBeLessThan(0)
  })

  it("nulls sempre por último, mesmo em desc", () => {
    expect(compareCustomFieldSortValues(null, 5, "asc")).toBeGreaterThan(0)
    expect(compareCustomFieldSortValues(5, null, "asc")).toBeLessThan(0)
    expect(compareCustomFieldSortValues(null, 5, "desc")).toBeGreaterThan(0)
    expect(compareCustomFieldSortValues(5, null, "desc")).toBeLessThan(0)
    expect(compareCustomFieldSortValues(undefined, undefined, "asc")).toBe(0)
    expect(compareCustomFieldSortValues(null, null, "desc")).toBe(0)
  })

  it("ordena strings (texto/select/date-ISO) via localeCompare pt-BR", () => {
    expect(compareCustomFieldSortValues("Ana", "Bruno", "asc")).toBeLessThan(0)
    expect(compareCustomFieldSortValues("Bruno", "Ana", "asc")).toBeGreaterThan(0)
    expect(compareCustomFieldSortValues("2026-01-01", "2026-06-01", "asc")).toBeLessThan(0)
  })

  it("ordena booleanos (false < true)", () => {
    expect(compareCustomFieldSortValues(false, true, "asc")).toBeLessThan(0)
    expect(compareCustomFieldSortValues(true, false, "asc")).toBeGreaterThan(0)
  })

  it("ordena multi_select (array) por join", () => {
    expect(compareCustomFieldSortValues(["a"], ["b"], "asc")).toBeLessThan(0)
  })
})
