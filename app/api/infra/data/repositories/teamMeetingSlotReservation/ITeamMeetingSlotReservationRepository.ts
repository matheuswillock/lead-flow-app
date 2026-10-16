import type { TeamMeetingSlotReservationSource } from "@prisma/client";

export type CreateTeamMeetingSlotReservationInput = {
  teamId: string;
  closerId: string;
  leadId?: string | null;
  publicFormSubmissionId?: string | null;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  source: TeamMeetingSlotReservationSource;
};

export type TeamMeetingSlotReservationResult =
  | { available: true; reservationId: string }
  | { available: false };

export interface ITeamMeetingSlotReservationRepository {
  reserve(input: CreateTeamMeetingSlotReservationInput): Promise<TeamMeetingSlotReservationResult>;
  consume(input: { reservationId: string; leadId?: string | null; googleEventId?: string | null; googleCalendarId?: string | null }): Promise<void>;
  attachToPublicFormSubmission(input: { reservationId: string; publicFormSubmissionId: string }): Promise<void>;
  attachToLead(input: { reservationId: string; leadId: string }): Promise<void>;
  markExternalEvent(input: { reservationId: string; googleEventId: string; googleCalendarId: string }): Promise<void>;
  findRecoverable(limit: number): Promise<Array<{
    id: string;
    leadId: string | null;
    googleEventId: string;
    googleCalendarId: string;
  }>>;
  markRecoveryFailure(reservationId: string, error: string): Promise<void>;
  release(reservationId: string): Promise<void>;
}
