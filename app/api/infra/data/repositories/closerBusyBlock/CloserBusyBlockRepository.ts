import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CloserBusyBlockWithProfile,
  CreateCloserBusyBlockData,
  ICloserBusyBlockRepository,
  UpdateCloserBusyBlockData,
} from "./ICloserBusyBlockRepository"

const profileSelect = {
  id: true,
  fullName: true,
  email: true,
  timezone: true,
  supabaseId: true,
  googleConnectionId: true,
  googleConnection: {
    select: {
      id: true,
      googleEmail: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
      revokedAt: true,
    },
  },
} as const

const blockSelect = {
  id: true,
  teamId: true,
  profileId: true,
  startsAt: true,
  endsAt: true,
  allDay: true,
  isRecurring: true,
  weekdays: true,
  recurrenceEndsAt: true,
  syncToGoogle: true,
  googleEventId: true,
  googleCalendarId: true,
  reason: true,
  createdByProfileId: true,
  createdAt: true,
  updatedAt: true,
  profile: { select: profileSelect },
} as const

export class CloserBusyBlockRepository implements ICloserBusyBlockRepository {
  async findById(id: string): Promise<CloserBusyBlockWithProfile | null> {
    return prisma.closerBusyBlock.findUnique({
      where: { id },
      select: blockSelect,
    }) as Promise<CloserBusyBlockWithProfile | null>
  }

  async findOverlapping(params: {
    teamId: string
    profileIds?: string[]
    rangeStart: Date
    rangeEnd: Date
  }): Promise<CloserBusyBlockWithProfile[]> {
    const { teamId, profileIds, rangeStart, rangeEnd } = params

    return prisma.closerBusyBlock.findMany({
      where: {
        teamId,
        ...(profileIds && profileIds.length > 0 ? { profileId: { in: profileIds } } : {}),
        OR: [
          {
            isRecurring: false,
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart },
          },
          {
            isRecurring: true,
            startsAt: { lt: rangeEnd },
            OR: [{ recurrenceEndsAt: null }, { recurrenceEndsAt: { gt: rangeStart } }],
          },
        ],
      },
      select: blockSelect,
      orderBy: [{ startsAt: "asc" }],
    }) as Promise<CloserBusyBlockWithProfile[]>
  }

  async findOverlappingByProfileIds(params: {
    profileIds: string[]
    rangeStart: Date
    rangeEnd: Date
  }): Promise<
    Array<{
      id: string
      profileId: string
      startsAt: Date
      endsAt: Date
      allDay: boolean
      isRecurring: boolean
      weekdays: number[]
      recurrenceEndsAt: Date | null
      timezone: string
    }>
  > {
    const { profileIds, rangeStart, rangeEnd } = params
    if (profileIds.length === 0) return []

    const rows = await prisma.closerBusyBlock.findMany({
      where: {
        profileId: { in: profileIds },
        OR: [
          {
            isRecurring: false,
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart },
          },
          {
            isRecurring: true,
            startsAt: { lt: rangeEnd },
            OR: [{ recurrenceEndsAt: null }, { recurrenceEndsAt: { gt: rangeStart } }],
          },
        ],
      },
      select: {
        id: true,
        profileId: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        isRecurring: true,
        weekdays: true,
        recurrenceEndsAt: true,
        profile: { select: { timezone: true } },
      },
    })

    return rows.map((row) => ({
      id: row.id,
      profileId: row.profileId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      allDay: row.allDay,
      isRecurring: row.isRecurring,
      weekdays: row.weekdays,
      recurrenceEndsAt: row.recurrenceEndsAt,
      timezone: row.profile.timezone,
    }))
  }

  async create(data: CreateCloserBusyBlockData): Promise<CloserBusyBlockWithProfile> {
    return prisma.closerBusyBlock.create({
      data: {
        id: data.id,
        teamId: data.teamId,
        profileId: data.profileId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        allDay: data.allDay,
        isRecurring: data.isRecurring,
        weekdays: data.weekdays,
        recurrenceEndsAt: data.recurrenceEndsAt,
        syncToGoogle: data.syncToGoogle,
        googleEventId: data.googleEventId ?? null,
        googleCalendarId: data.googleCalendarId ?? null,
        reason: data.reason ?? null,
        createdByProfileId: data.createdByProfileId,
      },
      select: blockSelect,
    }) as Promise<CloserBusyBlockWithProfile>
  }

  async update(id: string, data: UpdateCloserBusyBlockData): Promise<CloserBusyBlockWithProfile> {
    return prisma.closerBusyBlock.update({
      where: { id },
      data: {
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
        ...(data.allDay !== undefined ? { allDay: data.allDay } : {}),
        ...(data.isRecurring !== undefined ? { isRecurring: data.isRecurring } : {}),
        ...(data.weekdays !== undefined ? { weekdays: data.weekdays } : {}),
        ...(data.recurrenceEndsAt !== undefined ? { recurrenceEndsAt: data.recurrenceEndsAt } : {}),
        ...(data.syncToGoogle !== undefined ? { syncToGoogle: data.syncToGoogle } : {}),
        ...(data.googleEventId !== undefined ? { googleEventId: data.googleEventId } : {}),
        ...(data.googleCalendarId !== undefined ? { googleCalendarId: data.googleCalendarId } : {}),
        ...(data.reason !== undefined ? { reason: data.reason } : {}),
      },
      select: blockSelect,
    }) as Promise<CloserBusyBlockWithProfile>
  }

  async delete(id: string): Promise<void> {
    await prisma.closerBusyBlock.delete({ where: { id } })
  }

  async isCloserInTeam(teamId: string, profileId: string): Promise<boolean> {
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        profileId,
        OR: [{ functions: { has: "CLOSER" } }, { role: { in: ["manager", "backoffice"] } }],
      },
      select: { id: true },
    })
    return Boolean(member)
  }

  async findProfileTimezone(profileId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { timezone: true },
    })
    return profile?.timezone ?? null
  }
}

export const closerBusyBlockRepository = new CloserBusyBlockRepository()
