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

export type ValidTeamMeetingSlotReservation = {
  id: string;
  teamId: string;
  closerId: string;
  leadId: string | null;
  publicFormSubmissionId: string | null;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
};

export interface ITeamMeetingSlotReservationRepository {
  isCloserEligibleForTeam(teamId: string, closerId: string): Promise<boolean>;
  reserve(input: CreateTeamMeetingSlotReservationInput): Promise<TeamMeetingSlotReservationResult>;
  consume(input: { reservationId: string; leadId?: string | null; googleEventId?: string | null; googleCalendarId?: string | null; teamId?: string; closerId?: string; startsAt?: Date; durationMinutes?: number }): Promise<void>;
  validate(input: {
    reservationId: string;
    teamId?: string;
    closerId: string;
    leadId?: string | null;
    publicFormSubmissionId?: string | null;
    startsAt: Date;
    durationMinutes: number;
  }): Promise<boolean>;
  findValid(input: {
    reservationId: string;
    teamId?: string;
    closerId: string;
    leadId?: string | null;
    publicFormSubmissionId?: string | null;
    startsAt: Date;
  }): Promise<ValidTeamMeetingSlotReservation | null>;
  attachToPublicFormSubmission(input: { reservationId: string; publicFormSubmissionId: string }): Promise<void>;
  attachToLead(input: { reservationId: string; leadId: string }): Promise<void>;
  markExternalEvent(input: { reservationId: string; googleEventId: string; googleCalendarId: string }): Promise<void>;
  findRecoverable(limit: number): Promise<Array<{
    id: string;
    leadId: string | null;
    googleEventId: string;
    googleCalendarId: string;
    recoveryAttempts?: number;
  }>>;
  markRecoveryFailure(reservationId: string, error: string): Promise<void>;
  release(reservationId: string): Promise<void>;
  releaseAfterRecoveryTimeout?(reservationId: string): Promise<void>;
  releaseConsumedForLead(input: { leadId: string; exceptReservationId?: string }): Promise<void>;
}
