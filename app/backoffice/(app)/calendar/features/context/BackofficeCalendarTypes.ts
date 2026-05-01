import type {
  BackofficeCrmUserOption,
  BackofficeLeadItem,
  BackofficeLeadScheduleInput,
} from "@/app/backoffice/(app)/crm/features/context/BackofficeCrmTypes"
import type { IBackofficeCalendarService } from "../services/IBackofficeCalendarService"

export interface BackofficeCalendarContextValue {
  leads: BackofficeLeadItem[]
  users: BackofficeCrmUserOption[]
  closers: BackofficeCrmUserOption[]
  isLoading: boolean
  error: string | null
  timezone: string
  refresh: () => Promise<void>
  getAvailability: IBackofficeCalendarService["getAvailability"]
  scheduleLead: (leadId: string, input: BackofficeLeadScheduleInput) => Promise<void>
  cancelSchedule: (leadId: string) => Promise<void>
  getAttendees: IBackofficeCalendarService["getAttendees"]
}
