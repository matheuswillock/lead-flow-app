import type { GoogleOAuthConnection } from "@prisma/client";

export type CalendarAvailabilityCloserProfile = {
  id: string;
  email: string | null;
  timezone: string | null;
  googleCalendarConnected: boolean;
  googleRefreshToken: string | null;
  googleAccessToken: string | null;
  googleTokenExpiresAt: Date | null;
  googleConnection: GoogleOAuthConnection | null;
  supabaseId: string | null;
};

export type CalendarAvailabilityExcludedLead = {
  id: string;
  closerId: string | null;
  meetingDate: Date | null;
};

export type CalendarAvailabilityScheduledLead = {
  meetingDate: Date | null;
  closerId: string | null;
  meetingDurationMinutes: number | null;
};

export type CalendarAvailabilityReservation = {
  closerId: string;
  startsAt: Date;
  endsAt: Date;
};

export interface ICalendarAvailabilityRepository {
  /** Lead do closer (em qualquer time) cuja reunião sobrepõe `[startsAt, endsAt)`; `null` se livre. */
  findConflictingLeadId(params: { closerId: string; startsAt: Date; endsAt: Date }): Promise<string | null>;
  findMeetingDuration(teamId: string): Promise<number | null>;
  findTeamMemberProfileIds(teamId: string, requestedCloserIds: string[]): Promise<string[]>;
  findCloserProfiles(requestedCloserIds: string[]): Promise<CalendarAvailabilityCloserProfile[]>;
  findExcludedLead(excludeLeadId: string, teamId: string): Promise<CalendarAvailabilityExcludedLead | null>;
  findScheduledLeadsForDay(params: {
    teamId: string;
    requestedCloserIds: string[];
    dayStart: Date;
    dayEnd: Date;
  }): Promise<CalendarAvailabilityScheduledLead[]>;
  findActiveReservations(params: {
    teamId: string;
    requestedCloserIds: string[];
    rangeStart: Date;
    rangeEnd: Date;
    excludeLeadId?: string;
  }): Promise<CalendarAvailabilityReservation[]>;
}
