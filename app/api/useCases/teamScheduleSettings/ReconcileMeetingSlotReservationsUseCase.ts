import { Output } from "@/lib/output";
import {
  teamMeetingSlotReservationRepository,
} from "@/app/api/infra/data/repositories/teamMeetingSlotReservation/TeamMeetingSlotReservationRepository";
import { leadScheduleRepository } from "@/app/api/infra/data/repositories/leadSchedule/LeadScheduleRepository";

type RecoverableReservation = {
  id: string;
  leadId: string | null;
  googleEventId: string;
  googleCalendarId: string;
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
  ) {}

  async execute(): Promise<Output> {
    const recoverable = await this.reservations.findRecoverable(this.batchSize);
    let recovered = 0;
    let pending = 0;

    for (const reservation of recoverable) {
      try {
        if (!reservation.leadId) {
          pending += 1;
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
          pending += 1;
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
        pending += 1;
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
