import { TZDate } from "@date-fns/tz"
import { addDaysInTz, formatLocalDateValue, getDayRangeInTz, resolveTimezone } from "@/lib/dates"

export type BusyBlockOccurrence = {
  blockId: string
  profileId: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
}

export type BusyBlockRecord = {
  id: string
  profileId: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
  isRecurring: boolean
  weekdays: number[]
  recurrenceEndsAt: Date | null
}

const WEEKDAY_BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const

export function getWeekdayInTz(date: Date, timezone: string): number {
  return new TZDate(date, timezone).getDay()
}

export function buildWeeklyRrule(weekdays: number[], until: Date, timezone: string): string {
  const byDay = [...new Set(weekdays)]
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_BYDAY[day])
    .join(",")

  const untilKey = formatLocalDateValue(until, timezone).replaceAll("-", "")
  return `FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${untilKey}T235959Z`
}

function occurrenceDurationMs(startsAt: Date, endsAt: Date): number {
  return Math.max(endsAt.getTime() - startsAt.getTime(), 60_000)
}

/**
 * Materializa ocorrências de um busy block que intersectam [rangeStart, rangeEnd).
 */
export function materializeBusyBlockOccurrences(
  block: BusyBlockRecord,
  rangeStart: Date,
  rangeEnd: Date,
  timezoneInput?: string
): BusyBlockOccurrence[] {
  const timezone = resolveTimezone(timezoneInput)
  const occurrences: BusyBlockOccurrence[] = []

  if (!block.isRecurring || block.weekdays.length === 0) {
    if (block.endsAt > rangeStart && block.startsAt < rangeEnd) {
      occurrences.push({
        blockId: block.id,
        profileId: block.profileId,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        allDay: block.allDay,
      })
    }
    return occurrences
  }

  const seriesEnd = block.recurrenceEndsAt ?? block.endsAt
  if (seriesEnd <= rangeStart || block.startsAt >= rangeEnd) {
    return occurrences
  }

  const durationMs = occurrenceDurationMs(block.startsAt, block.endsAt)
  const weekdaySet = new Set(block.weekdays.filter((day) => day >= 0 && day <= 6))
  const startKey = formatLocalDateValue(
    block.startsAt.getTime() > rangeStart.getTime() ? block.startsAt : rangeStart,
    timezone
  )
  const endBound = seriesEnd.getTime() < rangeEnd.getTime() ? seriesEnd : rangeEnd
  const endKey = formatLocalDateValue(addDaysInTz(endBound, -1, timezone), timezone)

  let cursorKey = startKey
  let guard = 0
  while (cursorKey <= endKey && guard < 400) {
    guard += 1
    const dayStart = getDayRangeInTz(cursorKey, timezone).start
    const weekday = getWeekdayInTz(dayStart, timezone)

    if (weekdaySet.has(weekday)) {
      const startParts = new TZDate(block.startsAt, timezone)
      const occurrenceStart = new Date(
        new TZDate(
          Number(cursorKey.slice(0, 4)),
          Number(cursorKey.slice(5, 7)) - 1,
          Number(cursorKey.slice(8, 10)),
          startParts.getHours(),
          startParts.getMinutes(),
          startParts.getSeconds(),
          timezone
        ).valueOf()
      )
      const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs)

      if (occurrenceEnd > rangeStart && occurrenceStart < rangeEnd) {
        occurrences.push({
          blockId: block.id,
          profileId: block.profileId,
          startsAt: occurrenceStart,
          endsAt: occurrenceEnd,
          allDay: block.allDay,
        })
      }
    }

    cursorKey = formatLocalDateValue(addDaysInTz(dayStart, 1, timezone), timezone)
  }

  return occurrences
}

export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && endA > startB
}

export function isInstantInBusyOccurrences(
  instant: Date,
  durationMinutes: number,
  occurrences: BusyBlockOccurrence[]
): boolean {
  const end = new Date(instant.getTime() + durationMinutes * 60_000)
  return occurrences.some((occurrence) =>
    intervalsOverlap(instant, end, occurrence.startsAt, occurrence.endsAt)
  )
}
