import type { Output } from "@/lib/output";

export type GetCalendarAvailabilityUseCaseInput = {
  teamId: string;
  requestedCloserIds: string[];
  date: string;
  days?: number;
  excludeLeadId?: string;
  excludeLeadTeamId?: string;
  destinationTeamId?: string;
  userTimezone?: string;
};

export interface ICalendarAvailabilityUseCase {
  getAvailability(input: GetCalendarAvailabilityUseCaseInput): Promise<Output>;
}
