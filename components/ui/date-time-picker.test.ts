import { describe, expect, it } from "bun:test"

import { hasCalendarDayRestriction } from "./date-time-picker"

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
