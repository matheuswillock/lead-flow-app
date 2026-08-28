import { describe, expect, it } from "bun:test";
import { LeadStatus } from "@prisma/client";
import {
  parseCustomFieldFiltersQueryParam,
  parseCustomFieldSortQueryParam,
  parseLeadStatusQueryParam,
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

describe("parseLeadStatusQueryParam", () => {
  it("retorna undefined quando ausente", () => {
    expect(parseLeadStatusQueryParam(null)).toBeUndefined();
  });

  it("retorna undefined para string vazia", () => {
    expect(parseLeadStatusQueryParam("")).toBeUndefined();
  });

  it("aceita todos os valores do enum sem lançar", () => {
    for (const status of Object.values(LeadStatus)) {
      expect(parseLeadStatusQueryParam(status)).toBe(status);
    }
  });

  it("rejeita status fora do enum", () => {
    // Antes era `searchParams.get('status') as LeadStatus`, então isso chegava
    // até a consulta Prisma como enum inválido.
    expect(() => parseLeadStatusQueryParam("lixo")).toThrow();
  });

  it("rejeita status com caixa diferente", () => {
    expect(() => parseLeadStatusQueryParam("SCHEDULED")).toThrow();
  });
});
