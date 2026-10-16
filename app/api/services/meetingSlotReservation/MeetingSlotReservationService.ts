import { teamMeetingSlotReservationRepository } from "@/app/api/infra/data/repositories/teamMeetingSlotReservation/TeamMeetingSlotReservationRepository";
import type { ITeamMeetingSlotReservationRepository } from "@/app/api/infra/data/repositories/teamMeetingSlotReservation/ITeamMeetingSlotReservationRepository";
import { teamScheduleSettingsRepository } from "@/app/api/infra/data/repositories/teamScheduleSettings/TeamScheduleSettingsRepository";
import type { ITeamScheduleSettingsRepository } from "@/app/api/infra/data/repositories/teamScheduleSettings/ITeamScheduleSettingsRepository";
import {
  DEFAULT_MEETING_DURATION_MINUTES,
  isMeetingDurationMinutes,
} from "@/app/api/domain/teamScheduleSettings/meetingDuration";
import type {
  IMeetingSlotReservationService,
  MeetingSlotReservationResult,
  ReserveMeetingSlotInput,
} from "./IMeetingSlotReservationService";

export class MeetingSlotReservationService implements IMeetingSlotReservationService {
  constructor(
    private readonly reservations: ITeamMeetingSlotReservationRepository = teamMeetingSlotReservationRepository,
    private readonly settings: ITeamScheduleSettingsRepository = teamScheduleSettingsRepository,
  ) {}

  async reserve(input: ReserveMeetingSlotInput): Promise<MeetingSlotReservationResult> {
    const configuredDuration = await this.settings.findMeetingDuration(input.teamId);
    const durationMinutes = isMeetingDurationMinutes(configuredDuration)
      ? configuredDuration
      : DEFAULT_MEETING_DURATION_MINUTES;
    const endsAt = new Date(input.startsAt.getTime() + durationMinutes * 60 * 1_000);
    const reservation = await this.reservations.reserve({
      ...input,
      durationMinutes,
      endsAt,
    });
    return reservation.available
      ? { available: true, reservationId: reservation.reservationId, durationMinutes, endsAt }
      : { available: false };
  }

  consume(input: { reservationId: string; leadId?: string | null; googleEventId?: string | null; googleCalendarId?: string | null }) {
    return this.reservations.consume(input);
  }

  attachToPublicFormSubmission(input: { reservationId: string; publicFormSubmissionId: string }) {
    return this.reservations.attachToPublicFormSubmission(input);
  }

  attachToLead(input: { reservationId: string; leadId: string }) {
    return this.reservations.attachToLead(input);
  }

  markExternalEvent(input: { reservationId: string; googleEventId: string; googleCalendarId: string }) {
    return this.reservations.markExternalEvent(input);
  }

  release(reservationId: string) {
    return this.reservations.release(reservationId);
  }

  releaseConsumedForLead(input: { leadId: string; exceptReservationId?: string }) {
    return this.reservations.releaseConsumedForLead(input);
  }
}

export const meetingSlotReservationService: IMeetingSlotReservationService = new MeetingSlotReservationService();
