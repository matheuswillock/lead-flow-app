import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { TZDate } from "@date-fns/tz"
import type { Locale } from "date-fns"

/**
 * Formats a date using a date-fns pattern string, expressed in the given timezone.
 *
 * Example: formatInTz(d, "dd/MM/yyyy HH:mm", "America/Sao_Paulo")
 */
export function formatInTz(
  date: Date,
  pattern: string,
  tz: string,
  locale: Locale = ptBR
): string {
  const tzDate = new TZDate(date, tz)
  return format(tzDate, pattern, { locale })
}

/**
 * Formats a date as a relative string ("há 3 dias", "em 2 horas") in the given timezone.
 */
export function formatRelativeInTz(date: Date, tz: string, locale: Locale = ptBR): string {
  const tzDate = new TZDate(date, tz)
  return formatDistanceToNow(tzDate, { addSuffix: true, locale })
}
