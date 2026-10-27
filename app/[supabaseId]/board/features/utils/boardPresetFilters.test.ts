import { describe, expect, it } from "bun:test";
import {
  DEFAULT_BOARD_FILTERS,
  areBoardFiltersEqual,
  boardPresetDescriptionLabel,
  normalizeBoardPresetFilters,
} from "./boardPresetFilters";

describe("filtro 'Precisa remarcar' nos presets do quadro", () => {
  it("preset salvo antes do filtro existir volta com o filtro desligado", () => {
    const legacy = { query: "maria", onlyMeetingsHeld: true };

    expect(normalizeBoardPresetFilters(legacy).onlyNeedsReschedule).toBe(false);
  });

  it("só aceita o booleano true", () => {
    expect(normalizeBoardPresetFilters({ onlyNeedsReschedule: true }).onlyNeedsReschedule).toBe(true);
    expect(normalizeBoardPresetFilters({ onlyNeedsReschedule: "true" }).onlyNeedsReschedule).toBe(false);
  });

  it("filtros com e sem 'Precisa remarcar' não são iguais", () => {
    const on = { ...DEFAULT_BOARD_FILTERS, onlyNeedsReschedule: true };

    expect(areBoardFiltersEqual(on, DEFAULT_BOARD_FILTERS)).toBe(false);
    expect(areBoardFiltersEqual(on, { ...on })).toBe(true);
  });

  it("a descrição do preset cita o filtro", () => {
    expect(boardPresetDescriptionLabel({ ...DEFAULT_BOARD_FILTERS, onlyNeedsReschedule: true })).toContain("Precisa remarcar");
  });
});
