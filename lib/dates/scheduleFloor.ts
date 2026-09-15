import { formatLocalDateValue, formatLocalTimeValue } from "./parse"

/**
 * Piso de agendamento aplicado a um dia do calendário.
 *
 * - `unrestricted`: o dia inteiro está depois do piso, qualquer horário serve.
 * - `earliestTime`: o dia é o do piso, só horários a partir de `time` servem.
 * - `noTimeAvailable`: nenhum horário inteiro do dia está depois do piso.
 */
export type DayScheduleFloor =
  | { kind: "unrestricted" }
  | { kind: "earliestTime"; time: string }
  | { kind: "noTimeAvailable" }

const TIME_VALUE_PATTERN = /^(\d{2}):(\d{2})$/

function hasSubMinuteRemainder(date: Date): boolean {
  return date.getTime() % 60_000 !== 0
}

/** Minuto seguinte a `time`, ou `null` quando viraria o dia. */
function nextMinute(time: string): string | null {
  const match = TIME_VALUE_PATTERN.exec(time)
  if (!match) return null

  const totalMinutes = Number(match[1]) * 60 + Number(match[2]) + 1
  if (totalMinutes >= 24 * 60) return null

  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0")
  const minutes = String(totalMinutes % 60).padStart(2, "0")
  return `${hours}:${minutes}`
}

/**
 * Resolve o piso de horário de um dia (`dateKey` no formato `YYYY-MM-DD`) a
 * partir de um instante mínimo, ambos lidos no fuso `tz`.
 *
 * É uma DICA de interface — serve para pré-selecionar e filtrar horários. Quem
 * decide validade é a comparação direta de `Date` contra `minDateTime`, para
 * que nenhuma imprecisão de arredondamento vire brecha de submit.
 */
export function resolveDayScheduleFloor(params: {
  dateKey: string
  tz: string
  minDateTime: Date
}): DayScheduleFloor {
  const { dateKey, tz, minDateTime } = params
  const floorDateKey = formatLocalDateValue(minDateTime, tz)

  if (dateKey > floorDateKey) return { kind: "unrestricted" }
  if (dateKey < floorDateKey) return { kind: "noTimeAvailable" }

  const floorTime = formatLocalTimeValue(minDateTime, tz)
  if (!hasSubMinuteRemainder(minDateTime)) return { kind: "earliestTime", time: floorTime }

  // O minuto do piso já está correndo (ex.: 11:30:30): o primeiro minuto
  // inteiro ainda no futuro é o seguinte.
  const rounded = nextMinute(floorTime)
  return rounded ? { kind: "earliestTime", time: rounded } : { kind: "noTimeAvailable" }
}

/**
 * Horário a usar em `dateKey` respeitando o piso: mantém `preferredTime` quando
 * já é válido e avança para o menor horário permitido quando venceu.
 *
 * É o que impede um default pré-preenchido de nascer no passado (ex.: sugerir
 * "10:00" com o relógio já em 11:30).
 */
export function resolveTimeAtOrAfterFloor(params: {
  preferredTime: string
  dateKey: string
  tz: string
  minDateTime: Date
}): string {
  const { preferredTime, ...floorParams } = params
  if (!TIME_VALUE_PATTERN.test(preferredTime)) return preferredTime

  const floor = resolveDayScheduleFloor(floorParams)
  if (floor.kind !== "earliestTime") return preferredTime

  return preferredTime >= floor.time ? preferredTime : floor.time
}
