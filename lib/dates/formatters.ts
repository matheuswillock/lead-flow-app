import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { TZDate } from "@date-fns/tz"
import type { Locale } from "date-fns"

/**
 * Formats a date in the specified timezone using the given pattern and locale.
 * @param date - Date to be formatted
 * @param pattern - Date format pattern (e.g., "dd/MM/yyyy HH:mm")
 * @param timezone - Timezone identifier (e.g., "America/Sao_Paulo") to format the date in
 * @param locale - Optional locale for formatting the date (default is Brazilian Portuguese)
 * @returns Formatted date string in the specified timezone and locale
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
 * @param date - Date to be formatted as a relative time string (e.g., "há 5 minutos" or "em 3 dias")
 * @param timezone - Timezone identifier (e.g., "America/Sao_Paulo") to calculate the relative time in 
 * @param locale - Optional locale for formatting the relative time string (default is Brazilian Portuguese)
 * @returns A string like "há 5 minutos" or "em 3 dias", depending on whether the date is in the past or future, expressed in the given timezone.
 */
export function formatRelativeIntimezone(date: Date, timezone: string, locale: Locale = ptBR): string {
  const timezoneDate = new TZDate(date, timezone)
  return formatDistanceToNow(timezoneDate, { addSuffix: true, locale })
}

/**
 * Formats a date and time string in the given timezone.
 * @param value - Date string to be formatted
 * @param timezone - Timezone identifier (e.g., "America/Sao_Paulo") to format the date in
 * @returns Formatted date and time string, or the original value if formatting fails
 */
export function formatDateTime(value: string, timezone: string): string {
  try {
    return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", timezone)
  } catch {
    return value
  }
}
