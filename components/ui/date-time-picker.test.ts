import { describe, expect, it } from "bun:test"

import { getDatePickerYearBounds, hasCalendarDayRestriction } from "./date-time-picker"

describe("getDatePickerYearBounds", () => {
  it("mantém o calendário aberto para os próximos cinco anos", () => {
    expect(getDatePickerYearBounds({ currentYear: 2026 })).toEqual({ fromYear: 2020, toYear: 2031 })
  })

  it("permite configurar uma faixa histórica para datas de nascimento", () => {
    expect(getDatePickerYearBounds({ currentYear: 2026, fromYear: 1920, toYear: 2026 })).toEqual({
      fromYear: 1920,
      toYear: 2026,
    })
  })
})

/**
 * Regressão do achado P2 do Codex no PR #1177.
 *
 * O predicado `isDateDisabled` já conhecia o piso, mas só era ENTREGUE ao
 * `Calendar` quando `disablePastDates`, `availableDateKeys` ou `maxDateKey`
 * existiam. Quem passasse `minDateTime` com `disablePastDates={false}` recebia
 * um calendário sem restrição nenhuma — a prop prometia bloquear o passado e
 * liberava tudo, silenciosamente.
 */
describe("hasCalendarDayRestriction", () => {
  it("restringe quando só o piso foi informado, mesmo sem disablePastDates", () => {
    expect(
      hasCalendarDayRestriction({ disablePastDates: false, minDateKey: "2026-09-15" })
    ).toBe(true)
  })

  it("restringe com disablePastDates sozinho", () => {
    expect(hasCalendarDayRestriction({ disablePastDates: true })).toBe(true)
  })

  it("restringe com lista de dias disponíveis sozinha", () => {
    expect(
      hasCalendarDayRestriction({ disablePastDates: false, availableDateKeys: ["2026-09-20"] })
    ).toBe(true)
  })

  it("restringe com data máxima sozinha", () => {
    expect(hasCalendarDayRestriction({ disablePastDates: false, maxDateKey: "2026-09-30" })).toBe(
      true
    )
  })

  it("não restringe quando nenhuma regra de dia foi informada", () => {
    expect(hasCalendarDayRestriction({ disablePastDates: false })).toBe(false)
  })
})
