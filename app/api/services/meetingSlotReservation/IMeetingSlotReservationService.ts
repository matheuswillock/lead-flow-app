import type { TeamMeetingSlotReservationSource } from "@prisma/client";
import type { ValidTeamMeetingSlotReservation } from "@/app/api/infra/data/repositories/teamMeetingSlotReservation/ITeamMeetingSlotReservationRepository";

export type ReserveMeetingSlotInput = {
  teamId: string;
  closerId: string;
  startsAt: Date;
  leadId?: string | null;
  publicFormSubmissionId?: string | null;
  source: TeamMeetingSlotReservationSource;
};

export type MeetingSlotReservationResult =
  | { available: true; reservationId: string; durationMinutes: number; endsAt: Date }
  | { available: false };

export interface IMeetingSlotReservationService {
  isCloserEligibleForTeam(teamId: string, closerId: string): Promise<boolean>;
  reserve(input: ReserveMeetingSlotInput): Promise<MeetingSlotReservationResult>;
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
  release(reservationId: string): Promise<void>;
  releaseConsumedForLead(input: { leadId: string; exceptReservationId?: string }): Promise<void>;
}
