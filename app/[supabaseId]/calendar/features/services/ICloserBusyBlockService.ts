export type CloserBusyBlockItem = {
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

export type UpsertCloserBusyBlockPayload = {
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
    supabaseId: string
    teamId: string
    from: string
    to: string
    closerId?: string
  }): Promise<CloserBusyBlockItem[]>
  create(params: {
    supabaseId: string
    teamId: string
    payload: UpsertCloserBusyBlockPayload
  }): Promise<CloserBusyBlockItem>
  update(params: {
    supabaseId: string
    teamId: string
    id: string
    payload: UpsertCloserBusyBlockPayload
  }): Promise<CloserBusyBlockItem>
  remove(params: {
    supabaseId: string
    teamId: string
    id: string
  }): Promise<void>
}
