import type { CloserBusyBlock, Prisma } from "@prisma/client"

export type CreateCloserBusyBlockData = {
  id?: string
  teamId: string
  profileId: string
  startsAt: Date
  endsAt: Date
  allDay: boolean
  isRecurring: boolean
  weekdays: number[]
  recurrenceEndsAt: Date | null
  syncToGoogle: boolean
  googleEventId?: string | null
  googleCalendarId?: string | null
  reason?: string | null
  createdByProfileId: string
}

export type UpdateCloserBusyBlockData = {
  startsAt?: Date
  endsAt?: Date
  allDay?: boolean
  isRecurring?: boolean
  weekdays?: number[]
  recurrenceEndsAt?: Date | null
  syncToGoogle?: boolean
  googleEventId?: string | null
  googleCalendarId?: string | null
  reason?: string | null
}

export type CloserBusyBlockWithProfile = CloserBusyBlock & {
  profile: {
    id: string
    fullName: string | null
    email: string
    timezone: string
    supabaseId: string | null
    googleConnectionId: string | null
    googleConnection: {
      id: string
      googleEmail: string | null
      accessToken: string | null
      refreshToken: string | null
      tokenExpiresAt: Date | null
      revokedAt: Date | null
    } | null
  }
}

export interface ICloserBusyBlockRepository {
  findById(id: string): Promise<CloserBusyBlockWithProfile | null>
  findOverlapping(params: {
    teamId: string
    profileIds?: string[]
    rangeStart: Date
    rangeEnd: Date
  }): Promise<CloserBusyBlockWithProfile[]>
  findOverlappingByProfileIds(params: {
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
  >
  create(data: CreateCloserBusyBlockData): Promise<CloserBusyBlockWithProfile>
  update(id: string, data: UpdateCloserBusyBlockData): Promise<CloserBusyBlockWithProfile>
  delete(id: string): Promise<void>
  isCloserInTeam(teamId: string, profileId: string): Promise<boolean>
  findProfileTimezone(profileId: string): Promise<string | null>
}

export type CloserBusyBlockWhere = Prisma.CloserBusyBlockWhereInput
