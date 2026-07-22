import type { BackofficeLeadSchedule } from "@prisma/client"
import type { Output } from "@/lib/output"

export type BackofficeMeetingType = "online" | "call" | "whatsapp"

export interface UpsertBackofficeLeadScheduleInput {
  leadId: string
  leadName: string
  leadEmail?: string | null
  closerBackofficeUserId: string
  meetingDate: Date
  meetingTitle: string
  meetingNotes?: string | null
  meetingLink?: string | null
  meetingType?: BackofficeMeetingType | null
  extraGuests?: string[]
  createdByProfileId?: string | null
}

export interface CancelBackofficeLeadScheduleInput {
  leadId: string
  canceledByProfileId: string
  reason?: string | null
}

export interface GetBackofficeLeadScheduleAttendeesInput {
  leadId: string
}

export interface BackofficeLeadScheduleResult {
  schedule: BackofficeLeadSchedule
  meetingLink: string | null
  inviteDispatch: {
    status: "sent_google" | "sent_resend" | "failed"
    provider: "google" | "resend"
    fallbackUsed: boolean
    error: string | null
  }
}

export interface IBackofficeLeadScheduleService {
  listSchedules(leadId: string): Promise<Output>
  upsertSchedule(input: UpsertBackofficeLeadScheduleInput): Promise<Output>
  cancelSchedule(input: CancelBackofficeLeadScheduleInput): Promise<Output>
  getAttendees(input: GetBackofficeLeadScheduleAttendeesInput): Promise<Output>
  resendInvite(input: {
    leadId: string
    target: "all" | "single" | "new"
    email?: string
    emails?: string[]
  }): Promise<Output>
}
