import { describe, expect, it } from "bun:test";
import {
  parseCustomFieldFiltersQueryParam,
  parseCustomFieldSortQueryParam,
} from "./requestToListLeadsCustomFields";

const DEFINITION_ID = "11111111-1111-4111-8111-111111111111";

describe("parseCustomFieldFiltersQueryParam", () => {
  it("retorna undefined quando ausente", () => {
    expect(parseCustomFieldFiltersQueryParam(null)).toBeUndefined();
  });

  it("valida e retorna filtros válidos", () => {
    const raw = JSON.stringify([{ definitionId: DEFINITION_ID, operator: "eq", value: "Ouro" }]);
    expect(parseCustomFieldFiltersQueryParam(raw)).toEqual([
      { definitionId: DEFINITION_ID, operator: "eq", value: "Ouro" },
    ]);
  });

  it("rejeita mais de 3 filtros", () => {
    const raw = JSON.stringify(
      Array.from({ length: 4 }, () => ({ definitionId: DEFINITION_ID, operator: "not_empty" }))
    );
    expect(() => parseCustomFieldFiltersQueryParam(raw)).toThrow();
  });

  it("rejeita operador inválido", () => {
    const raw = JSON.stringify([{ definitionId: DEFINITION_ID, operator: "invalid" }]);
    expect(() => parseCustomFieldFiltersQueryParam(raw)).toThrow();
  });

  it("rejeita JSON malformado", () => {
    expect(() => parseCustomFieldFiltersQueryParam("{not json")).toThrow();
  });

  it("exige value para eq/neq/contains", () => {
    for (const operator of ["eq", "neq", "contains"]) {
      const raw = JSON.stringify([{ definitionId: DEFINITION_ID, operator }]);
      expect(() => parseCustomFieldFiltersQueryParam(raw)).toThrow();
    }
  });

  it("permite value ausente para is_empty/not_empty", () => {
    for (const operator of ["is_empty", "not_empty"]) {
      const raw = JSON.stringify([{ definitionId: DEFINITION_ID, operator }]);
      expect(() => parseCustomFieldFiltersQueryParam(raw)).not.toThrow();
    }
  });
});

describe("parseCustomFieldSortQueryParam", () => {
  it("retorna undefined quando ausente", () => {
    expect(parseCustomFieldSortQueryParam(null)).toBeUndefined();
  });

  it("valida e retorna sort válido", () => {
    const raw = JSON.stringify({ definitionId: DEFINITION_ID, direction: "desc" });
    expect(parseCustomFieldSortQueryParam(raw)).toEqual({
      definitionId: DEFINITION_ID,
      direction: "desc",
    });
  });

  it("rejeita direction inválida", () => {
    const raw = JSON.stringify({ definitionId: DEFINITION_ID, direction: "sideways" });
    expect(() => parseCustomFieldSortQueryParam(raw)).toThrow();
  });
});
