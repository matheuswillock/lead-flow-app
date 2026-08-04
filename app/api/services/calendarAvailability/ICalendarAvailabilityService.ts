export type CalendarAvailabilityResult = {
  availableTimes: string[];
  source: "google" | "internal";
  perCloser: Record<string, string[]>;
  days: Record<string, string[]>;
};

export type GetCalendarAvailabilityInput = {
  teamId: string;
  requestedCloserIds: string[];
  date: string;
  days?: number;
  excludeLeadId?: string;
  excludeLeadTeamId?: string;
  userTimezone?: string;
};

export type CalendarAvailabilityServiceErrorCode = "CLOSERS_NOT_IN_TEAM" | "CLOSERS_NOT_FOUND";

export class CalendarAvailabilityServiceError extends Error {
  constructor(public readonly code: CalendarAvailabilityServiceErrorCode, message: string) {
    super(message);
    this.name = "CalendarAvailabilityServiceError";
  }
}

export interface ICalendarAvailabilityService {
  getAvailability(input: GetCalendarAvailabilityInput): Promise<CalendarAvailabilityResult>;
}
