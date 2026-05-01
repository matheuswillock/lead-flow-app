import type {
  BackofficeCrmUserOption,
  BackofficeLeadItem,
  BackofficeLeadScheduleInput,
} from "@/app/backoffice/(app)/crm/features/context/BackofficeCrmTypes"

export interface BackofficeCalendarAvailability {
  availableTimes: string[]
  source: "google" | "internal"
  perCloser: Record<string, string[]>
}

export interface IBackofficeCalendarService {
  listLeads(): Promise<BackofficeLeadItem[]>
  listUsers(): Promise<BackofficeCrmUserOption[]>
  getAvailability(input: {
    closerIds: string[]
    date: string
    timezone: string
    excludeLeadId?: string | null
  }): Promise<BackofficeCalendarAvailability>
  scheduleLead(leadId: string, input: BackofficeLeadScheduleInput): Promise<BackofficeLeadItem>
  cancelSchedule(leadId: string, reason?: string | null): Promise<BackofficeLeadItem>
  getAttendees(leadId: string): Promise<{
    hasGoogleData: boolean
    attendees: Array<{
      email: string
      name: string | null
      responseStatus: string
      source: string
    }>
  }>
}
