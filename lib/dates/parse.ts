import { TZDate } from "@date-fns/tz"

/**
 * Converts the string produced by <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
 * to the equivalent UTC Date, interpreting the local string as being in the given timezone.
 *
 * Example: parseLocalToUtc("2026-05-10T14:30", "America/Sao_Paulo") → 2026-05-10T17:30:00.000Z
 */
export function parseLocalToUtc(localIso: string, tz: string): Date {
  // TZDate interprets the wall-clock string as belonging to `tz` and stores UTC internally.
  const tzDate = new TZDate(localIso, tz)
  return new Date(tzDate)
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
