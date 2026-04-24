import {
  addDays,
  addMonths,
  differenceInDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns"
import { TZDate } from "@date-fns/tz"

/** Returns current instant as a plain Date (UTC), semantically "now in that TZ". */
export function nowInTz(tz: string): Date {
  return new Date(new TZDate(new Date(), tz).toISOString())
}

/** Start of the day in the given timezone, returned as UTC Date. */
export function startOfDayInTz(date: Date, tz: string): Date {
  const tzDate = new TZDate(date, tz)
  const sod = startOfDay(tzDate)
  return new Date(sod)
}

/** End of the day in the given timezone, returned as UTC Date. */
export function endOfDayInTz(date: Date, tz: string): Date {
  const tzDate = new TZDate(date, tz)
  const eod = endOfDay(tzDate)
  return new Date(eod)
}

/** Start of the month in the given timezone, returned as UTC Date. */
export function startOfMonthInTz(date: Date, tz: string): Date {
  const tzDate = new TZDate(date, tz)
  const som = startOfMonth(tzDate)
  return new Date(som)
}

/** End of the month in the given timezone, returned as UTC Date. */
export function endOfMonthInTz(date: Date, tz: string): Date {
  const tzDate = new TZDate(date, tz)
  const eom = endOfMonth(tzDate)
  return new Date(eom)
}

/** Add days, respecting DST boundaries in the given timezone. */
export function addDaysInTz(date: Date, amount: number, tz: string): Date {
  const tzDate = new TZDate(date, tz)
  return new Date(addDays(tzDate, amount))
}

/** Add months, respecting DST and month-boundary rules in the given timezone. */
export function addMonthsInTz(date: Date, amount: number, tz: string): Date {
  const tzDate = new TZDate(date, tz)
  return new Date(addMonths(tzDate, amount))
}

/** Compare two dates by day/hour/minute granularity in the given timezone. */
export function compareInTz(
  a: Date,
  b: Date,
  tz: string,
  granularity: "day" | "hour" | "minute" = "minute"
): -1 | 0 | 1 {
  const fmt = (d: Date) => {
    const tzDate = new TZDate(d, tz)
    const year = tzDate.getFullYear()
    const month = tzDate.getMonth()
    const day = tzDate.getDate()
    const hour = tzDate.getHours()
    const minute = tzDate.getMinutes()
    if (granularity === "day") return year * 10000 + month * 100 + day
    if (granularity === "hour") return (year * 10000 + month * 100 + day) * 100 + hour
    return ((year * 10000 + month * 100 + day) * 100 + hour) * 100 + minute
  }
  const va = fmt(a)
  const vb = fmt(b)
  if (va < vb) return -1
  if (va > vb) return 1
  return 0
}

/** Returns true if both dates fall on the same calendar day in the given timezone. */
export function isSameDayInTz(a: Date, b: Date, tz: string): boolean {
  return compareInTz(a, b, tz, "day") === 0
}

/** Returns true if the date is in the past relative to now in the given timezone. */
export function isPastInTz(date: Date, tz: string): boolean {
  return compareInTz(date, new Date(), tz, "minute") < 0
}

/** Returns true if the date is in the future relative to now in the given timezone. */
export function isFutureInTz(date: Date, tz: string): boolean {
  return compareInTz(date, new Date(), tz, "minute") > 0
}

/** Difference in calendar days between two dates in the given timezone. */
export function differenceInDaysInTz(later: Date, earlier: Date, tz: string): number {
  const sodLater = startOfDayInTz(later, tz)
  const sodEarlier = startOfDayInTz(earlier, tz)
  return differenceInDays(sodLater, sodEarlier)
}
