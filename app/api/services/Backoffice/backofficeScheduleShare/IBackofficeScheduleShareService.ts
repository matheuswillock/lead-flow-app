export type BackofficeScheduleShareSummary = {
  leadId: string
  leadName: string
  meetingTitle: string
  meetingDate: string
  meetingType: string
  expiresAt: string
  timezone: string
  isPreSchedule: boolean
}

export type BackofficePublicScheduleShareResult = {
  leadName: string
  meetingTitle: string
  meetingDate: string
  meetingType: string
  expiresAt: string
  availableAt: string
  timezone: string
  joinAllowed: boolean
  meetingLink: string | null
  isPreSchedule: boolean
}

export interface IBackofficeScheduleShareService {
  createPublicShare(input: { leadId: string }): Promise<{
    publicUrl: string
    expiresAt: string
    summary: BackofficeScheduleShareSummary
  }>
  getPublicShare(token: string): Promise<BackofficePublicScheduleShareResult>
}
