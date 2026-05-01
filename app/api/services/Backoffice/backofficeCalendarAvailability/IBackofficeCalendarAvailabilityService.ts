export interface GetBackofficeCalendarAvailabilityInput {
  closerIds: string[]
  date: string
  excludeLeadId?: string | null
  userTimezone?: string | null
}

export interface BackofficeCalendarAvailabilityResult {
  availableTimes: string[]
  source: "google" | "internal"
  perCloser: Record<string, string[]>
}

export interface IBackofficeCalendarAvailabilityService {
  getAvailability(
    input: GetBackofficeCalendarAvailabilityInput
  ): Promise<BackofficeCalendarAvailabilityResult>
}
