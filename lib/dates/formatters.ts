import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { TZDate } from "@date-fns/tz"
import type { Locale } from "date-fns"

/**
 * Formats a date using a date-fns pattern string, expressed in the given timezone.
 *
 * Example: formatIntimezone(d, "dd/MM/yyyy HH:mm", "America/Sao_Paulo")
 */
export function formatIntimezone(
  date: Date,
  pattern: string,
  timezone: string,
  locale: Locale = ptBR
): string {
  const timezoneDate = new TZDate(date, timezone)
  return format(timezoneDate, pattern, { locale })
}

/**
 * Formats a date as a relative string ("há 3 dias", "em 2 horas") in the given timezone.
 */
export function formatRelativeIntimezone(date: Date, timezone: string, locale: Locale = ptBR): string {
  const timezoneDate = new TZDate(date, timezone)
  return formatDistanceToNow(timezoneDate, { addSuffix: true, locale })
}

/**
 * Formats a date and time string in the given timezone.
 * @param value 
 * @param timezone 
 * @returns 
 */
export function formatDateTime(value: string, timezone: string): string {
  try {
    return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", timezone)
  } catch {
    return value
  }
}
