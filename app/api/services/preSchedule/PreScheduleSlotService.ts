import { DEFAULT_TZ, formatLocalDateValue, getDayRangeInTz, getMinutesInTz, resolveTimezone } from "@/lib/dates"
import { preScheduleSlotRepository } from "@/app/api/infra/data/repositories/preSchedule/PreScheduleSlotRepository"
import { closerBusyBlockRepository } from "@/app/api/infra/data/repositories/closerBusyBlock/CloserBusyBlockRepository"
import {
  isInstantInBusyOccurrences,
  materializeBusyBlockOccurrences,
} from "@/lib/closer-busy-block/materialize"

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

function getBlockedCloserIdsAtSlot(
  blocks: Array<{
    id: string
    profileId: string
    startsAt: Date
    endsAt: Date
    allDay: boolean
    isRecurring: boolean
    weekdays: number[]
    recurrenceEndsAt: Date | null
    timezone: string
  }>,
  meetingDate: Date,
  timezone: string
): Set<string> {
  const slotEnd = new Date(meetingDate.getTime() + PRE_SCHEDULE_SLOT_MINUTES * 60_000)
  const blockedCloserIds = new Set<string>()

  for (const block of blocks) {
    const blockTimezone = resolveTimezone(block.timezone || timezone)
    const occurrences = materializeBusyBlockOccurrences(
      {
        id: block.id,
        profileId: block.profileId,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        allDay: block.allDay,
        isRecurring: block.isRecurring,
        weekdays: block.weekdays,
        recurrenceEndsAt: block.recurrenceEndsAt,
      },
      meetingDate,
      slotEnd,
      blockTimezone
    )
    if (isInstantInBusyOccurrences(meetingDate, PRE_SCHEDULE_SLOT_MINUTES, occurrences)) {
      blockedCloserIds.add(block.profileId)
    }
  }

  return blockedCloserIds
}

async function hasFreeEligibleCloser(
  sourceTeamId: string,
  meetingDate: Date,
  timezone: string
): Promise<boolean> {
  const closerIds = await preScheduleSlotRepository.findEligibleTargetCloserIds(sourceTeamId)
  if (closerIds.length === 0) return false

  const slotEnd = new Date(meetingDate.getTime() + PRE_SCHEDULE_SLOT_MINUTES * 60_000)
  const blocks = await closerBusyBlockRepository.findOverlappingByProfileIds({
    profileIds: closerIds,
    rangeStart: meetingDate,
    rangeEnd: slotEnd,
  })
  const blockedCloserIds = getBlockedCloserIdsAtSlot(blocks, meetingDate, timezone)

  return closerIds.some((closerId) => !blockedCloserIds.has(closerId))
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
  const masterTimezone = await preScheduleSlotRepository.findTeamMasterTimezone(teamId)
  const timezone = resolveTimezone(timezoneInput ?? masterTimezone) || DEFAULT_TZ
  const dateParam = formatLocalDateValue(meetingDate, timezone)

  const { usage, capacity } = await getPreScheduleSlotUsage(
    teamId,
    dateParam,
    timezone,
    excludeLeadId
  )
  const minute =
    Math.floor(getMinutesInTz(meetingDate, timezone) / PRE_SCHEDULE_SLOT_MINUTES) *
    PRE_SCHEDULE_SLOT_MINUTES
  const usageAtSlot = usage.get(minute) ?? 0
  const capacityOk = capacity > 0 && usageAtSlot < capacity
  const hasFreeCloser = capacityOk
    ? await hasFreeEligibleCloser(teamId, meetingDate, timezone)
    : false

  return {
    available: capacityOk && hasFreeCloser,
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

  const occupiedByCapacity = new Set(getFullyOccupiedSlots(usage, capacity))
  const closerIds = await preScheduleSlotRepository.findEligibleTargetCloserIds(teamId)
  const { start: dayStart, end: dayEnd } = getDayRangeInTz(dateParam, timezone)
  const blockedMinutes = new Set<number>()

  if (closerIds.length === 0) {
    for (let minute = 0; minute < 24 * 60; minute += PRE_SCHEDULE_SLOT_MINUTES) {
      blockedMinutes.add(minute)
    }
  } else {
    const allBlocks = await closerBusyBlockRepository.findOverlappingByProfileIds({
      profileIds: closerIds,
      rangeStart: dayStart,
      rangeEnd: dayEnd,
    })

    for (let minute = 0; minute < 24 * 60; minute += PRE_SCHEDULE_SLOT_MINUTES) {
      const slotStart = new Date(dayStart.getTime() + minute * 60_000)
      const blockedCloserIds = getBlockedCloserIdsAtSlot(allBlocks, slotStart, timezone)
      const hasFree = closerIds.some((closerId) => !blockedCloserIds.has(closerId))
      if (!hasFree) blockedMinutes.add(minute)
    }
  }

  const occupiedSlots = Array.from(new Set([...occupiedByCapacity, ...blockedMinutes])).sort(
    (a, b) => a - b
  )
  const slotUsage = Object.fromEntries(usage.entries())

  return { occupiedSlots, slotCapacity: capacity, slotUsage, timezone }
}
