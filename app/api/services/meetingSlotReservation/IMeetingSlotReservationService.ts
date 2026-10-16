import type { TeamMeetingSlotReservationSource } from "@prisma/client";

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
  reserve(input: ReserveMeetingSlotInput): Promise<MeetingSlotReservationResult>;
  consume(input: { reservationId: string; leadId?: string | null; googleEventId?: string | null; googleCalendarId?: string | null }): Promise<void>;
  attachToPublicFormSubmission(input: { reservationId: string; publicFormSubmissionId: string }): Promise<void>;
  attachToLead(input: { reservationId: string; leadId: string }): Promise<void>;
  markExternalEvent(input: { reservationId: string; googleEventId: string; googleCalendarId: string }): Promise<void>;
  release(reservationId: string): Promise<void>;
}
