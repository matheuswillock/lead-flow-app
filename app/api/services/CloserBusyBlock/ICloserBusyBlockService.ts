import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { Output } from "@/lib/output"
import type { CloserBusyBlockWithProfile } from "@/app/api/infra/data/repositories/closerBusyBlock/ICloserBusyBlockRepository"

export type CloserBusyBlockDto = {
  id: string
  teamId: string
  profileId: string
  closerName: string | null
  closerEmail: string
  startsAt: string
  endsAt: string
  allDay: boolean
  isRecurring: boolean
  weekdays: number[]
  recurrenceEndsAt: string | null
  syncToGoogle: boolean
  googleEventId: string | null
  reason: string | null
  createdByProfileId: string
  createdAt: string
  updatedAt: string
  occurrenceStartsAt?: string
  occurrenceEndsAt?: string
}

export type UpsertCloserBusyBlockInput = {
  profileId: string
  startsAt: string
  endsAt: string
  allDay: boolean
  isRecurring: boolean
  weekdays: number[]
  recurrenceEndsAt?: string | null
  syncToGoogle: boolean
  reason?: string | null
}

export interface ICloserBusyBlockService {
  list(params: {
    access: TeamAccess
    from: Date
    to: Date
    closerId?: string
  }): Promise<Output>
  create(params: {
    access: TeamAccess
    input: UpsertCloserBusyBlockInput
  }): Promise<Output>
  update(params: {
    access: TeamAccess
    id: string
    input: UpsertCloserBusyBlockInput
  }): Promise<Output>
  remove(params: {
    access: TeamAccess
    id: string
  }): Promise<Output>
  attachGoogleEvent(
    id: string,
    google: { googleEventId: string | null; googleCalendarId: string | null; syncToGoogle: boolean }
  ): Promise<CloserBusyBlockWithProfile>
}
