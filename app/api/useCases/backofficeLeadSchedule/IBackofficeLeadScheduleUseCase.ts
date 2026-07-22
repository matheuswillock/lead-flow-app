import type { Output } from "@/lib/output"

export type BackofficeLeadSchedulePayload = {
  closerBackofficeUserId?: unknown
  meetingDate?: unknown
  meetingTitle?: unknown
  meetingNotes?: unknown
  meetingLink?: unknown
  meetingType?: unknown
  meetingExtraGuests?: unknown
  extraGuests?: unknown
}

export interface IBackofficeLeadScheduleUseCase {
  listSchedules(leadId: string): Promise<Output>
  scheduleLead(params: {
    leadId: string
    payload: BackofficeLeadSchedulePayload
  }): Promise<Output>
  cancelSchedule(params: {
    leadId: string
    canceledByProfileId: string
    reason: unknown
  }): Promise<Output>
  getAttendees(leadId: string): Promise<Output>
  resendInvite(params: {
    leadId: string
    target: "all" | "single" | "new"
    email?: string
    emails?: string[]
  }): Promise<Output>
}

