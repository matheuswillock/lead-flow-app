import { Output } from "@/lib/output";
import {
  teamMeetingSlotReservationRepository,
} from "@/app/api/infra/data/repositories/teamMeetingSlotReservation/TeamMeetingSlotReservationRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import { cancelCalendarEvent } from "@/app/api/services/googleCalendar/GoogleCalendarService";

type RecoverableReservation = {
  id: string;
  leadId: string | null;
  closerId: string;
  googleEventId: string;
  googleCalendarId: string;
  recoveryAttempts?: number;
};

export type MeetingSlotExternalEvent = {
  closerId: string;
  googleEventId: string;
  googleCalendarId: string;
};

export interface IMeetingSlotExternalEventCancellation {
  cancel(input: MeetingSlotExternalEvent): Promise<void>;
}

const defaultExternalEventCancellation: IMeetingSlotExternalEventCancellation = {
  async cancel(input) {
    const closer = await profileRepository.findById(input.closerId);
    if (!closer?.googleConnectionId) {
      throw new Error("O closer não possui uma conexão Google válida.");
    }

    await cancelCalendarEvent({
      organizer: {
        id: closer.id,
        supabaseId: closer.supabaseId,
        timezone: closer.timezone,
        googleConnectionId: closer.googleConnectionId,
      },
      eventId: input.googleEventId,
      calendarId: input.googleCalendarId,
    });
  },
};

export type IMeetingSlotRecoveryRepository = {
  findRecoverable(limit: number): Promise<RecoverableReservation[]>;
  consume(input: {
    reservationId: string;
    leadId?: string | null;
    googleEventId?: string | null;
    googleCalendarId?: string | null;
  }): Promise<void>;
  markRecoveryFailure(reservationId: string, error: string): Promise<void>;
  releaseAfterRecoveryTimeout?(reservationId: string): Promise<void>;
};

export type IMeetingSlotRecoveryScheduleRepository = {
  findUniqueByLeadId(leadId: string): Promise<{
    googleEventId: string | null;
    googleCalendarId: string | null;
  } | null>;
};

/**
 * Fecha a janela entre criar evento no Google e gravar a agenda local. A
 * reconciliação nunca cria outro evento: ela só consome uma reserva quando a
 * agenda persistida já aponta para o mesmo evento externo.
 */
export class ReconcileMeetingSlotReservationsUseCase {
  constructor(
    private readonly reservations: IMeetingSlotRecoveryRepository = teamMeetingSlotReservationRepository,
    private readonly schedules: IMeetingSlotRecoveryScheduleRepository = leadScheduleRepository,
    private readonly batchSize = 100,
    private readonly externalEvents: IMeetingSlotExternalEventCancellation =
      defaultExternalEventCancellation,
  ) {}

  async execute(): Promise<Output> {
    const recoverable = await this.reservations.findRecoverable(this.batchSize);
    let recovered = 0;
    let pending = 0;

    for (const reservation of recoverable) {
      let pendingCounted = false;
      const countPending = () => {
        if (pendingCounted) return;
        pending += 1;
        pendingCounted = true;
      };

      try {
        if (!reservation.leadId) {
          countPending();
          if (
            (reservation.recoveryAttempts ?? 0) >= 19 &&
            this.reservations.releaseAfterRecoveryTimeout
          ) {
            await this.externalEvents.cancel({
              closerId: reservation.closerId,
              googleEventId: reservation.googleEventId,
              googleCalendarId: reservation.googleCalendarId,
            });
            await this.reservations.releaseAfterRecoveryTimeout(reservation.id);
            continue;
          }
          await this.reservations.markRecoveryFailure(
            reservation.id,
            "Reserva com evento externo ainda não possui lead para reconciliação.",
          );
          continue;
        }

        const schedule = await this.schedules.findUniqueByLeadId(reservation.leadId);
        const matchesExternalEvent =
          schedule?.googleEventId === reservation.googleEventId &&
          schedule.googleCalendarId === reservation.googleCalendarId;
        if (!matchesExternalEvent) {
          countPending();
          if (
            (reservation.recoveryAttempts ?? 0) >= 19 &&
            this.reservations.releaseAfterRecoveryTimeout
          ) {
            await this.externalEvents.cancel({
              closerId: reservation.closerId,
              googleEventId: reservation.googleEventId,
              googleCalendarId: reservation.googleCalendarId,
            });
            await this.reservations.releaseAfterRecoveryTimeout(reservation.id);
            continue;
          }
          await this.reservations.markRecoveryFailure(
            reservation.id,
            "Agenda local ainda não referencia o evento externo reservado.",
          );
          continue;
        }

        await this.reservations.consume({
          reservationId: reservation.id,
          leadId: reservation.leadId,
          googleEventId: reservation.googleEventId,
          googleCalendarId: reservation.googleCalendarId,
        });
        recovered += 1;
      } catch (error) {
        countPending();
        await this.reservations.markRecoveryFailure(
          reservation.id,
          error instanceof Error ? error.message : "Erro desconhecido ao reconciliar reserva.",
        );
      }
    }

    return new Output(true, [], [], {
      candidates: recoverable.length,
      recovered,
      pending,
      truncated: recoverable.length >= this.batchSize,
    });
  }
}

export const reconcileMeetingSlotReservationsUseCase = new ReconcileMeetingSlotReservationsUseCase();
