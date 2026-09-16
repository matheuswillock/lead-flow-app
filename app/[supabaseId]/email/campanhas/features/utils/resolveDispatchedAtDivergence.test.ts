import { describe, expect, it } from "bun:test"
import { isDispatchedLate } from "./resolveDispatchedAtDivergence"

describe("isDispatchedLate (T-M31.15)", () => {
  it("false quando ainda não foi enviado (sentAt null) — não é atraso, é pendência", () => {
    expect(isDispatchedLate("2026-09-07T10:00:00.000Z", null)).toBe(false)
  })

  it("false quando não há agendamento (scheduledAt null) — nada para comparar", () => {
    expect(isDispatchedLate(null, "2026-09-08T00:00:00.000Z")).toBe(false)
  })

  it("false quando enviado no horário (mesmo instante do agendamento)", () => {
    expect(
      isDispatchedLate("2026-09-07T10:00:00.000Z", "2026-09-07T10:05:00.000Z")
    ).toBe(false)
  })

  /**
   * Caso real (time Rafael): parte 3 agendada 07/09 10:00, saiu 08/09 00:00
   * — quase 14h de atraso por starvation do teto diário.
   */
  it("true quando o envio real saiu mais de 1h depois do agendado (caso Rafael)", () => {
    expect(
      isDispatchedLate("2026-09-07T10:00:00.000Z", "2026-09-08T00:00:00.000Z")
    ).toBe(true)
  })

  it("false na borda exata de 1h (limite não é atraso ainda)", () => {
    expect(
      isDispatchedLate("2026-09-07T10:00:00.000Z", "2026-09-07T11:00:00.000Z")
    ).toBe(false)
  })

  it("true logo após passar de 1h de atraso", () => {
    expect(
      isDispatchedLate("2026-09-07T10:00:00.000Z", "2026-09-07T11:00:00.001Z")
    ).toBe(true)
  })
})
