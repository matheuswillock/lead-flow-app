import { DEFAULT_TZ, getDayRangeInTz, getMinutesInTz, resolveTimezone } from "@/lib/dates"
import { preScheduleSlotRepository } from "@/app/api/infra/data/repositories/preSchedule/PreScheduleSlotRepository"

export const PRE_SCHEDULE_SLOT_MINUTES = 30

export async function getPreScheduleSlotCapacity(teamId: string): Promise<number> {
  return preScheduleSlotRepository.countTransferRoutesBySourceTeam(teamId)
}

async function findTransferLeadsInDay(
  teamId: string,
  dateParam: string,
  timezone: string,
  excludeLeadId?: string
) {
  const { start: startOfDay, end: endOfDay } = getDayRangeInTz(dateParam, timezone)

  return preScheduleSlotRepository.findTransferLeadMeetingDatesInDay(
    teamId,
    startOfDay,
    endOfDay,
    excludeLeadId
  )
}

export function countSlotUsage(
  leads: Array<{ meetingDate: Date | null }>,
  timezone: string
): Map<number, number> {
  const usage = new Map<number, number>()

  for (const lead of leads) {
    if (!lead.meetingDate) continue
    const minute =
      Math.floor(getMinutesInTz(lead.meetingDate, timezone) / PRE_SCHEDULE_SLOT_MINUTES) *
      PRE_SCHEDULE_SLOT_MINUTES
    usage.set(minute, (usage.get(minute) ?? 0) + 1)
  }

  return usage
}

export async function getPreScheduleSlotUsage(
  teamId: string,
  dateParam: string,
  timezoneInput?: string,
  excludeLeadId?: string
): Promise<{ usage: Map<number, number>; capacity: number; timezone: string }> {
  const masterTimezone = await preScheduleSlotRepository.findTeamMasterTimezone(teamId)
  const timezone = resolveTimezone(timezoneInput ?? masterTimezone) || DEFAULT_TZ
  const capacity = await getPreScheduleSlotCapacity(teamId)
  const leads = await findTransferLeadsInDay(teamId, dateParam, timezone, excludeLeadId)

  return {
    usage: countSlotUsage(leads, timezone),
    capacity,
    timezone,
  }
}

export function getFullyOccupiedSlots(usage: Map<number, number>, capacity: number): number[] {
  if (capacity <= 0) {
    return Array.from(usage.keys())
  }

  return Array.from(usage.entries())
    .filter(([, count]) => count >= capacity)
    .map(([minute]) => minute)
}

export async function isPreScheduleSlotAvailable(
  teamId: string,
  meetingDate: Date,
  timezoneInput?: string,
  excludeLeadId?: string
): Promise<{ available: boolean; capacity: number; usageAtSlot: number }> {
  const dateParam = meetingDate.toISOString().slice(0, 10)
  const { usage, capacity, timezone } = await getPreScheduleSlotUsage(
    teamId,
    dateParam,
    timezoneInput,
    excludeLeadId
  )
  const minute =
    Math.floor(getMinutesInTz(meetingDate, timezone) / PRE_SCHEDULE_SLOT_MINUTES) *
    PRE_SCHEDULE_SLOT_MINUTES
  const usageAtSlot = usage.get(minute) ?? 0

  return {
    available: capacity > 0 && usageAtSlot < capacity,
    capacity,
    usageAtSlot,
  }
}

export async function getPreScheduleSlotsPayload(
  teamId: string,
  dateParam: string,
  timezoneInput?: string,
  excludeLeadId?: string
) {
  const { usage, capacity, timezone } = await getPreScheduleSlotUsage(
    teamId,
    dateParam,
    timezoneInput,
    excludeLeadId
  )

  const occupiedSlots = getFullyOccupiedSlots(usage, capacity)
  const slotUsage = Object.fromEntries(usage.entries())

  return { occupiedSlots, slotCapacity: capacity, slotUsage, timezone }
}
