import type {
  BackofficeInviteDispatchStatus,
  BackofficeLeadSchedule,
  Prisma,
} from "@prisma/client"

export interface CreateBackofficeLeadScheduleInput {
  id?: string
  leadId: string
  closerBackofficeUserId?: string | null
  date: Date
  meetingTitle?: string | null
  notes?: string | null
  meetingLink?: string | null
  meetingType?: string | null
  extraGuests?: string[]
  googleEventId?: string | null
  googleCalendarId?: string | null
  inviteDispatchStatus?: BackofficeInviteDispatchStatus | null
  inviteDispatchProvider?: string | null
  inviteDispatchFallbackUsed?: boolean
  inviteDispatchLastAttemptAt?: Date | null
  inviteDispatchLastError?: string | null
  inviteDispatchLastPayload?: Prisma.InputJsonValue | null
  publicShareTokenHash?: string | null
  publicShareExpiresAt?: Date | null
  createdByProfileId?: string | null
}

export interface UpdateBackofficeLeadScheduleInput {
  closerBackofficeUserId?: string | null
  date?: Date
  meetingTitle?: string | null
  notes?: string | null
  meetingLink?: string | null
  meetingType?: string | null
  extraGuests?: string[]
  googleEventId?: string | null
  googleCalendarId?: string | null
  inviteDispatchStatus?: BackofficeInviteDispatchStatus | null
  inviteDispatchProvider?: string | null
  inviteDispatchFallbackUsed?: boolean
  inviteDispatchLastAttemptAt?: Date | null
  inviteDispatchLastError?: string | null
  inviteDispatchLastPayload?: Prisma.InputJsonValue | null
  publicShareTokenHash?: string | null
  publicShareExpiresAt?: Date | null
  isCanceled?: boolean
  canceledAt?: Date | null
  canceledByProfileId?: string | null
  cancelReason?: string | null
}

export interface BackofficeLeadScheduleForCalendar {
  id: string
  leadId: string
  closerBackofficeUserId: string | null
  date: Date
  meetingTitle: string | null
  notes: string | null
  meetingLink: string | null
  extraGuests: string[]
  googleEventId: string | null
  googleCalendarId: string | null
  inviteDispatchStatus: BackofficeInviteDispatchStatus | null
  inviteDispatchProvider: string | null
  isCanceled: boolean
}

export interface IBackofficeLeadScheduleRepository {
  create(data: CreateBackofficeLeadScheduleInput): Promise<BackofficeLeadSchedule>
  findByLeadId(leadId: string): Promise<BackofficeLeadSchedule[]>
  findLatestByLeadId(leadId: string): Promise<BackofficeLeadSchedule | null>
  findLatestActiveByLeadId(leadId: string): Promise<BackofficeLeadSchedule | null>
  findById(id: string): Promise<BackofficeLeadSchedule | null>
  findActiveForDay(params: {
    closerBackofficeUserIds: string[]
    dayStart: Date
    dayEnd: Date
  }): Promise<BackofficeLeadScheduleForCalendar[]>
  update(id: string, data: UpdateBackofficeLeadScheduleInput): Promise<BackofficeLeadSchedule>
  markCanceled(
    id: string,
    data: {
      canceledByProfileId?: string | null
      cancelReason?: string | null
    }
  ): Promise<BackofficeLeadSchedule>
}
