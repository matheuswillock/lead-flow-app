import type { Output } from "@/lib/output"

export interface GetBackofficeCalendarAvailabilityUseCaseInput {
  closerIds: string[]
  date: string
  excludeLeadId?: string | null
  userTimezone?: string | null
}

export interface IBackofficeCalendarAvailabilityUseCase {
  getAvailability(input: GetBackofficeCalendarAvailabilityUseCaseInput): Promise<Output>
}
