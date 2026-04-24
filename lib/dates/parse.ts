import { TZDate } from "@date-fns/tz"

/**
 * Converts the string produced by <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
 * to the equivalent UTC Date, interpreting the local string as being in the given timezone.
 *
 * Example: parseLocalToUtc("2026-05-10T14:30", "America/Sao_Paulo") → 2026-05-10T17:30:00.000Z
 */
export function parseLocalToUtc(localIso: string, tz: string): Date {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localIso)

  if (!match) {
    throw new Error(`Invalid local datetime: ${localIso}`)
  }

  const [, year, month, day, hour, minute, second = "0"] = match
  const tzDate = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    tz
  )

  return new Date(tzDate.valueOf())
}

/**
 * Formats a UTC Date back into the "YYYY-MM-DDTHH:mm" string expected by
 * <input type="datetime-local">, expressed in the given timezone.
 *
 * Example: formatLocalInputValue(new Date("2026-05-10T17:30:00Z"), "America/Sao_Paulo") → "2026-05-10T14:30"
 */
export function formatLocalInputValue(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

export function formatLocalDateValue(date: Date, tz: string): string {
  return formatLocalInputValue(date, tz).slice(0, 10)
}

export function formatLocalTimeValue(date: Date, tz: string): string {
  return formatLocalInputValue(date, tz).slice(11, 16)
}

export function parseDateKeyToUtc(dateKey: string, tz: string): Date {
  return parseLocalToUtc(`${dateKey}T00:00:00`, tz)
}

export function parseDateKeyAndTimeToUtc(dateKey: string, time: string, tz: string): Date {
  return parseLocalToUtc(`${dateKey}T${time}:00`, tz)
}

export function combineDateAndTimeInTz(date: Date, time: string, tz: string): Date {
  return parseDateKeyAndTimeToUtc(formatLocalDateValue(date, tz), time, tz)
}
