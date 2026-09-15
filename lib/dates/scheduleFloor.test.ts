import { describe, expect, it } from "bun:test"

import { resolveDayScheduleFloor, resolveTimeAtOrAfterFloor } from "./scheduleFloor"

const SP = "America/Sao_Paulo"

/** 2026-09-15T14:30:00Z === 2026-09-15 11:30 em America/Sao_Paulo. */
const FLOOR = new Date("2026-09-15T14:30:00.000Z")

describe("resolveDayScheduleFloor", () => {
  it("não restringe dias posteriores ao piso", () => {
    expect(resolveDayScheduleFloor({ dateKey: "2026-09-16", tz: SP, minDateTime: FLOOR })).toEqual({
      kind: "unrestricted",
    })
  })

  it("no dia do piso, o horário mínimo é o do próprio piso", () => {
    expect(resolveDayScheduleFloor({ dateKey: "2026-09-15", tz: SP, minDateTime: FLOOR })).toEqual({
      kind: "earliestTime",
      time: "11:30",
    })
  })

  it("arredonda para o minuto seguinte quando o piso tem segundos", () => {
    // 11:30:30 — 11:30 já passou, o primeiro minuto inteiro válido é 11:31.
    const withSeconds = new Date("2026-09-15T14:30:30.000Z")
    expect(
      resolveDayScheduleFloor({ dateKey: "2026-09-15", tz: SP, minDateTime: withSeconds })
    ).toEqual({ kind: "earliestTime", time: "11:31" })
  })

  it("não arredonda quando o piso cai exatamente no minuto", () => {
    const exact = new Date("2026-09-15T14:30:00.000Z")
    expect(resolveDayScheduleFloor({ dateKey: "2026-09-15", tz: SP, minDateTime: exact })).toEqual({
      kind: "earliestTime",
      time: "11:30",
    })
  })

  it("reporta dia sem horário disponível quando o piso é anterior ao dia", () => {
    expect(resolveDayScheduleFloor({ dateKey: "2026-09-14", tz: SP, minDateTime: FLOOR })).toEqual({
      kind: "noTimeAvailable",
    })
  })

  it("reporta dia sem horário quando o arredondamento viraria o dia", () => {
    // 2026-09-16T02:59:30Z === 2026-09-15 23:59:30 em SP: o próximo minuto
    // inteiro já é 00:00 do dia seguinte, então hoje não tem horário válido.
    const almostMidnight = new Date("2026-09-16T02:59:30.000Z")
    expect(
      resolveDayScheduleFloor({ dateKey: "2026-09-15", tz: SP, minDateTime: almostMidnight })
    ).toEqual({ kind: "noTimeAvailable" })
  })

  it("resolve o dia do piso no fuso informado, não no fuso do runner", () => {
    // 2026-09-15T02:00:00Z ainda é 14/09 23:00 em SP — o dia do piso é 14, não 15.
    const lateNight = new Date("2026-09-15T02:00:00.000Z")
    expect(
      resolveDayScheduleFloor({ dateKey: "2026-09-14", tz: SP, minDateTime: lateNight })
    ).toEqual({ kind: "earliestTime", time: "23:00" })
    expect(resolveDayScheduleFloor({ dateKey: "2026-09-15", tz: SP, minDateTime: lateNight })).toEqual(
      { kind: "unrestricted" }
    )
  })
})

describe("resolveTimeAtOrAfterFloor", () => {
  it("preserva o horário preferido quando já é válido", () => {
    expect(
      resolveTimeAtOrAfterFloor({
        preferredTime: "14:00",
        dateKey: "2026-09-15",
        tz: SP,
        minDateTime: FLOOR,
      })
    ).toBe("14:00")
  })

  it("avança o horário preferido que já venceu no dia do piso", () => {
    // Caso real do bug: default "10:00" com o relógio já em 11:30.
    expect(
      resolveTimeAtOrAfterFloor({
        preferredTime: "10:00",
        dateKey: "2026-09-15",
        tz: SP,
        minDateTime: FLOOR,
      })
    ).toBe("11:30")
  })

  it("preserva o horário preferido em dias posteriores ao piso", () => {
    expect(
      resolveTimeAtOrAfterFloor({
        preferredTime: "10:00",
        dateKey: "2026-09-16",
        tz: SP,
        minDateTime: FLOOR,
      })
    ).toBe("10:00")
  })

  it("mantém o horário preferido quando o dia não tem horário disponível", () => {
    // Dia inteiro inválido: nada a sugerir, quem valida é a comparação de Date.
    expect(
      resolveTimeAtOrAfterFloor({
        preferredTime: "10:00",
        dateKey: "2026-09-14",
        tz: SP,
        minDateTime: FLOOR,
      })
    ).toBe("10:00")
  })
})
