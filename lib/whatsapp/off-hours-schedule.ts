import { z } from "zod"
import { TZDate } from "@date-fns/tz"
import { formatLocalDateValue } from "@/lib/dates"
import { resolveTimezone } from "@/lib/dates"

export type OffHoursTimeRange = {
  start: string
  end: string
}

export type OffHoursSchedule = {
  timezone?: string
  days?: Partial<Record<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat", OffHoursTimeRange[]>>
  holidays?: string[]
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:mm)")

const offHoursTimeRangeSchema = z
  .object({
    start: timeSchema,
    end: timeSchema,
  })
  .strict()

const offHoursDayKeySchema = z.enum(DAY_KEYS)

/**
 * Valida a estrutura de OffHoursSchedule enviada pelo frontend antes de
 * persistir como JSON (evita salvar objetos malformados que quebrariam a
 * avaliação de regras em lib/whatsapp/auto-response-evaluation.ts).
 */
export const offHoursScheduleSchema = z
  .object({
    timezone: z.string().min(1, "Timezone inválido").optional(),
    days: z.partialRecord(offHoursDayKeySchema, z.array(offHoursTimeRangeSchema)).optional(),
    holidays: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)"))
      .optional(),
  })
  .strict()

function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

function getDayKey(date: Date, timezone: string): (typeof DAY_KEYS)[number] {
  const tzDate = new TZDate(date, timezone)
  return DAY_KEYS[tzDate.getDay()] ?? "mon"
}

function getCurrentMinutes(date: Date, timezone: string): number {
  const tzDate = new TZDate(date, timezone)
  return tzDate.getHours() * 60 + tzDate.getMinutes()
}

export function isWithinBusinessHours(
  schedule: OffHoursSchedule | null | undefined,
  now: Date,
  fallbackTimezone: string
): boolean {
  if (!schedule?.days || Object.keys(schedule.days).length === 0) {
    return true
  }

  const timezone = resolveTimezone(schedule.timezone ?? fallbackTimezone)
  const dateKey = formatLocalDateValue(now, timezone)

  if (schedule.holidays?.includes(dateKey)) {
    return false
  }

  const dayKey = getDayKey(now, timezone)
  const ranges = schedule.days[dayKey] ?? []
  if (ranges.length === 0) {
    return false
  }

  const currentMinutes = getCurrentMinutes(now, timezone)
  return ranges.some((range) => {
    const start = parseMinutes(range.start)
    const end = parseMinutes(range.end)
    if (start === null || end === null) return false
    if (start <= end) {
      return currentMinutes >= start && currentMinutes < end
    }
    return currentMinutes >= start || currentMinutes < end
  })
}

export function isOffHours(
  schedule: OffHoursSchedule | null | undefined,
  now: Date,
  fallbackTimezone: string
): boolean {
  return !isWithinBusinessHours(schedule, now, fallbackTimezone)
}
