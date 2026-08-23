import { describe, expect, it } from "bun:test";
import { isBoundedLeadsQuery } from "./boundedLeadsQuery";
import {
  canonicalizeCustomFieldFilters,
  canonicalizeCustomFieldSort,
} from "@/app/api/v1/leads/DTO/requestToListLeadsCustomFields";

const DEF_A = "11111111-1111-4111-8111-111111111111";
const DEF_B = "22222222-2222-4222-8222-222222222222";

function boardQuery(overrides: Partial<Parameters<typeof isBoundedLeadsQuery>[0]> = {}) {
  return {
    search: null,
    startDate: null,
    endDate: null,
    limit: undefined,
    customFieldFiltersJSON: "",
    ...overrides,
  };
}

describe("isBoundedLeadsQuery — o que entra no cache", () => {
  it("aceita a consulta do board (sem busca, sem datas, sem limit)", () => {
    expect(isBoundedLeadsQuery(boardQuery())).toBe(true);
  });

  it("aceita a consulta do calendário (janela não faz parte do predicado)", () => {
    expect(isBoundedLeadsQuery(boardQuery())).toBe(true);
  });

  it("aceita filtro de campo personalizado dentro do limite de tamanho", () => {
    const filtersJSON = canonicalizeCustomFieldFilters([
      { definitionId: DEF_A, operator: "eq", value: "Ouro" },
    ]);
    expect(isBoundedLeadsQuery(boardQuery({ customFieldFiltersJSON: filtersJSON }))).toBe(true);
  });
});

describe("isBoundedLeadsQuery — o que faz bypass", () => {
  it("rejeita busca livre (typeahead do merge e do inbox)", () => {
    expect(isBoundedLeadsQuery(boardQuery({ search: "joao" }))).toBe(false);
  });

  it("rejeita busca de uma letra só", () => {
    expect(isBoundedLeadsQuery(boardQuery({ search: "j" }))).toBe(false);
  });

  it("rejeita startDate isolado", () => {
    expect(isBoundedLeadsQuery(boardQuery({ startDate: "2026-08-01T00:00:00.000Z" }))).toBe(false);
  });

  it("rejeita endDate isolado", () => {
    expect(isBoundedLeadsQuery(boardQuery({ endDate: "2026-08-31T23:59:59.999Z" }))).toBe(false);
  });

  it("rejeita quando limit está definido — separa hooks/useLeads do board", () => {
    expect(isBoundedLeadsQuery(boardQuery({ limit: 10 }))).toBe(false);
  });

  it("rejeita limit 0, que é definido mesmo sendo falsy", () => {
    expect(isBoundedLeadsQuery(boardQuery({ limit: 0 }))).toBe(false);
  });

  it("rejeita filtro de campo personalizado patologicamente grande", () => {
    expect(
      isBoundedLeadsQuery(boardQuery({ customFieldFiltersJSON: "x".repeat(513) }))
    ).toBe(false);
  });
});

describe("canonicalizeCustomFieldFilters — estabilidade da chave", () => {
  it("devolve string vazia quando ausente ou vazio", () => {
    expect(canonicalizeCustomFieldFilters(undefined)).toBe("");
    expect(canonicalizeCustomFieldFilters([])).toBe("");
  });

  it("produz a mesma chave para a mesma consulta em ordem diferente", () => {
    const ab = canonicalizeCustomFieldFilters([
      { definitionId: DEF_A, operator: "eq", value: "Ouro" },
      { definitionId: DEF_B, operator: "eq", value: "Prata" },
    ]);
    const ba = canonicalizeCustomFieldFilters([
      { definitionId: DEF_B, operator: "eq", value: "Prata" },
      { definitionId: DEF_A, operator: "eq", value: "Ouro" },
    ]);

    expect(ab).toBe(ba);
  });

  it("desempata por operator quando o definitionId repete", () => {
    const um = canonicalizeCustomFieldFilters([
      { definitionId: DEF_A, operator: "not_empty" },
      { definitionId: DEF_A, operator: "is_empty" },
    ]);
    const outro = canonicalizeCustomFieldFilters([
      { definitionId: DEF_A, operator: "is_empty" },
      { definitionId: DEF_A, operator: "not_empty" },
    ]);

    expect(um).toBe(outro);
  });

  it("mantém chaves distintas para valores distintos", () => {
    const ouro = canonicalizeCustomFieldFilters([
      { definitionId: DEF_A, operator: "eq", value: "Ouro" },
    ]);
    const prata = canonicalizeCustomFieldFilters([
      { definitionId: DEF_A, operator: "eq", value: "Prata" },
    ]);

    expect(ouro).not.toBe(prata);
  });

  it("omite value quando ausente, sem virar null na chave", () => {
    const key = canonicalizeCustomFieldFilters([{ definitionId: DEF_A, operator: "is_empty" }]);
    expect(key).not.toContain("value");
  });
});

describe("canonicalizeCustomFieldSort", () => {
  it("devolve string vazia quando ausente", () => {
    expect(canonicalizeCustomFieldSort(undefined)).toBe("");
  });

  it("é estável para o mesmo sort", () => {
    const a = canonicalizeCustomFieldSort({ definitionId: DEF_A, direction: "asc" });
    const b = canonicalizeCustomFieldSort({ definitionId: DEF_A, direction: "asc" });
    expect(a).toBe(b);
  });

  it("distingue direções", () => {
    const asc = canonicalizeCustomFieldSort({ definitionId: DEF_A, direction: "asc" });
    const desc = canonicalizeCustomFieldSort({ definitionId: DEF_A, direction: "desc" });
    expect(asc).not.toBe(desc);
  });
});
