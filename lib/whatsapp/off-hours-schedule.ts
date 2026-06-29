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
