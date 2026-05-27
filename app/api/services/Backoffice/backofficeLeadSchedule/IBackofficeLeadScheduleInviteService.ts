import type { Output } from "@/lib/output"

export interface SendBackofficeLeadScheduleInviteInput {
  leadName: string
  leadEmail?: string | null
  closerName: string
  closerEmail: string
  meetingDate: Date
  meetingTitle: string
  meetingLink: string
  meetingNotes?: string | null
  extraGuests?: string[]
  eventUid: string
  timezone?: string | null
}

export interface SendCloserNewLeadNotificationInput {
  closerEmail: string
  leadName: string
  leadEmail?: string | null
  leadPhone?: string | null
  meetingDate: Date
  meetingTitle: string
  meetingLink?: string | null
  timezone?: string | null
}

export interface IBackofficeLeadScheduleInviteService {
  sendInvite(input: SendBackofficeLeadScheduleInviteInput): Promise<Output>
  sendCloserNewLeadNotification(input: SendCloserNewLeadNotificationInput): Promise<Output>
}
