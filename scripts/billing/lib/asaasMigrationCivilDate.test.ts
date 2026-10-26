import { describe, expect, it } from "bun:test"
import { isDueDateReachedInSaoPaulo } from "./asaasMigrationCivilDate"

describe("isDueDateReachedInSaoPaulo", () => {
  it("não considera vencido no início do dia UTC enquanto ainda é o dia anterior em São Paulo", () => {
    const beforeCivilDueDate = new Date("2026-11-30T01:00:00.000Z")

    expect(isDueDateReachedInSaoPaulo("2026-11-30", beforeCivilDueDate)).toBe(false)
  })

  it("considera vencido após a virada do dia civil em São Paulo", () => {
    const civilDueDate = new Date("2026-11-30T03:00:00.000Z")

    expect(isDueDateReachedInSaoPaulo("2026-11-30", civilDueDate)).toBe(true)
  })

  it("falha fechado para datas inválidas", () => {
    expect(isDueDateReachedInSaoPaulo("2026-02-30", new Date("2026-03-01T12:00:00.000Z"))).toBe(false)
  })
})
