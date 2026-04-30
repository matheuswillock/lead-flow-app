import { DEFAULT_TZ, formatLocalDateValue, getDayRangeInTz, getMinutesInTz, resolveTimezone } from "@/lib/dates"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficeUserRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficeUserRepository"
import type { IBackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backofficeLeadSchedule/IBackofficeLeadScheduleRepository"
import { BackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backofficeLeadSchedule/BackofficeLeadScheduleRepository"
import type { IBackofficeGoogleCalendarService } from "@/app/api/services/backofficeGoogleCalendar/IBackofficeGoogleCalendarService"
import { backofficeGoogleCalendarService } from "@/app/api/services/backofficeGoogleCalendar/BackofficeGoogleCalendarService"
import type {
  BackofficeCalendarAvailabilityResult,
  GetBackofficeCalendarAvailabilityInput,
  IBackofficeCalendarAvailabilityService,
} from "./IBackofficeCalendarAvailabilityService"

const SLOT_MINUTES = 30

function formatTimeSlot(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function sortTimeSlots(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number)
  const [bh, bm] = b.split(":").map(Number)
  return ah * 60 + am - (bh * 60 + bm)
}

export class BackofficeCalendarAvailabilityService
  implements IBackofficeCalendarAvailabilityService
{
  constructor(
    private readonly userRepo: IBackofficeUserRepository,
    private readonly scheduleRepo: IBackofficeLeadScheduleRepository,
    private readonly googleCalendarService: IBackofficeGoogleCalendarService
  ) {}

  async getAvailability(
    input: GetBackofficeCalendarAvailabilityInput
  ): Promise<BackofficeCalendarAvailabilityResult> {
    const timezone = resolveTimezone(input.userTimezone ?? DEFAULT_TZ)
    const closerIds = Array.from(new Set(input.closerIds))
    const closers = await Promise.all(closerIds.map((id) => this.userRepo.findById(id)))
    const activeClosers = closers.filter(
      (closer): closer is NonNullable<(typeof closers)[number]> =>
        !!closer?.isActive && closer.isCloser
    )

    if (activeClosers.length !== closerIds.length) {
      throw new Error("CLOSERS_NOT_FOUND")
    }

    const { start: dayStart, end: dayEnd } = getDayRangeInTz(input.date, timezone)
    const internalSchedules = await this.scheduleRepo.findActiveForDay({
      closerBackofficeUserIds: closerIds,
      dayStart,
      dayEnd,
    })

    const internalBusyByCloser = internalSchedules.reduce<
      Record<string, Array<{ start: string; end: string }>>
    >((acc, schedule) => {
      if (!schedule.closerBackofficeUserId) return acc
      const end = new Date(schedule.date.getTime() + SLOT_MINUTES * 60 * 1000)
      acc[schedule.closerBackofficeUserId] = acc[schedule.closerBackofficeUserId] || []
      acc[schedule.closerBackofficeUserId].push({
        start: schedule.date.toISOString(),
        end: end.toISOString(),
      })
      return acc
    }, {})

    const preservedSlotByCloser = new Map<string, string>()
    if (input.excludeLeadId) {
      const excluded = await this.scheduleRepo.findLatestActiveByLeadId(input.excludeLeadId)
      if (excluded?.closerBackofficeUserId) {
        const excludedDay = formatLocalDateValue(excluded.date, timezone)
        if (excludedDay === input.date) {
          preservedSlotByCloser.set(
            excluded.closerBackofficeUserId,
            formatTimeSlot(getMinutesInTz(excluded.date, timezone))
          )
        }
      }
    }

    const now = new Date()
    const todayKey = formatLocalDateValue(now, timezone)
    const isToday = input.date === todayKey
    const nowMinutes = getMinutesInTz(now, timezone)
    const slots = Array.from(
      { length: 24 * (60 / SLOT_MINUTES) },
      (_, index) => index * SLOT_MINUTES
    )

    const computeAvailability = (busyIntervals: Array<{ start: string; end: string }>) =>
      slots
        .filter((slotStart) => {
          if (isToday && slotStart < nowMinutes) return false

          const slotEnd = slotStart + SLOT_MINUTES
          return !busyIntervals.some((interval) => {
            const startDate = new Date(interval.start)
            const endDate = new Date(interval.end)
            if (endDate <= now) return false
            if (endDate <= dayStart || startDate >= dayEnd) return false

            const startClamp = startDate < dayStart ? dayStart : startDate
            const endClamp = endDate > dayEnd ? dayEnd : endDate
            const busyStart = getMinutesInTz(startClamp, timezone)
            const busyEnd = getMinutesInTz(endClamp, timezone)

            return slotStart < busyEnd && slotEnd > busyStart
          })
        })
        .map(formatTimeSlot)

    const perCloser: Record<string, string[]> = {}
    let source: "google" | "internal" = "internal"

    for (const closer of activeClosers) {
      let busyIntervals = internalBusyByCloser[closer.id] ?? []
      const canUseGoogleCalendar =
        !!closer.googleCalendarConnected && !!closer.googleRefreshToken

      if (canUseGoogleCalendar) {
        try {
          busyIntervals = await this.googleCalendarService.getBusyIntervals({
            organizer: closer,
            timeMin: dayStart.toISOString(),
            timeMax: dayEnd.toISOString(),
          })
          source = "google"
        } catch (error) {
          console.warn("[BackofficeCalendarAvailabilityService][GoogleFallback]", error)
        }
      }

      const closerAvailability = computeAvailability(busyIntervals)
      const preservedSlot = preservedSlotByCloser.get(closer.id)
      if (preservedSlot && !closerAvailability.includes(preservedSlot)) {
        closerAvailability.push(preservedSlot)
        closerAvailability.sort(sortTimeSlots)
      }
      perCloser[closer.id] = closerAvailability
    }

    return {
      availableTimes: Array.from(new Set(Object.values(perCloser).flat())).sort(sortTimeSlots),
      source,
      perCloser,
    }
  }
}

export const backofficeCalendarAvailabilityService =
  new BackofficeCalendarAvailabilityService(
    new BackofficeUserRepository(),
    new BackofficeLeadScheduleRepository(),
    backofficeGoogleCalendarService
  )
