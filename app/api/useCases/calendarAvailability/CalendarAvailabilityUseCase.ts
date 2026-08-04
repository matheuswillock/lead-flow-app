import { Output } from "@/lib/output";
import { calendarAvailabilityService } from "@/app/api/services/calendarAvailability/CalendarAvailabilityService";
import {
  CalendarAvailabilityServiceError,
  type GetCalendarAvailabilityInput,
  type ICalendarAvailabilityService,
} from "@/app/api/services/calendarAvailability/ICalendarAvailabilityService";
import { backofficeOperationalAccessService } from "@/app/api/services/backofficeOperationalAccess/BackofficeOperationalAccessService";
import { multiskillTransferRepository } from "@/app/api/infra/data/repositories/multiskillTransfer/MultiskillTransferRepository";
import {
  isMultiskillOriginMaster,
  resolveMultiskillOriginMasterId,
} from "@/lib/multiskill/is-multiskill-origin-master";
import type {
  GetCalendarAvailabilityUseCaseInput,
  ICalendarAvailabilityUseCase,
} from "./ICalendarAvailabilityUseCase";

export const CALENDAR_AVAILABILITY_ERROR_MESSAGES = {
  MISSING_CLOSERS: "Informe um closerId ou closerIds.",
  CLOSERS_NOT_IN_TEAM: "Um ou mais closers não pertencem ao time informado.",
  CLOSERS_NOT_FOUND: "Closers não encontrados.",
  MULTISKILL_DESTINATION_DENIED:
    "Acesso negado: destino externo de agenda exige origem MultiSkill autorizada.",
  MULTISKILL_DESTINATION_INVALID:
    "Time destino MultiSkill inválido para consultar disponibilidade.",
  INTERNAL_ERROR: "Erro interno do servidor",
} as const;

export class CalendarAvailabilityUseCase implements ICalendarAvailabilityUseCase {
  constructor(private readonly service: ICalendarAvailabilityService) {}

  async getAvailability(input: GetCalendarAvailabilityUseCaseInput): Promise<Output> {
    try {
      if (!input.requestedCloserIds || input.requestedCloserIds.length === 0) {
        return new Output(false, [], [CALENDAR_AVAILABILITY_ERROR_MESSAGES.MISSING_CLOSERS], null);
      }

      let teamId = input.teamId;
      let excludeLeadTeamId = input.excludeLeadTeamId ?? input.teamId;

      if (input.destinationTeamId && input.destinationTeamId !== input.teamId) {
        const originMasterId = await resolveMultiskillOriginMasterId();
        const hasMultiskillOrigin =
          isMultiskillOriginMaster({ managerId: input.managerId }, originMasterId) &&
          (await backofficeOperationalAccessService.hasMultiskillOriginTeam(input.teamId));
        if (!hasMultiskillOrigin) {
          return new Output(
            false,
            [],
            [CALENDAR_AVAILABILITY_ERROR_MESSAGES.MULTISKILL_DESTINATION_DENIED],
            null
          );
        }

        const destinationTeam =
          await multiskillTransferRepository.findDefaultTeamOwnedByMultiskillMaster(
            input.destinationTeamId
          );
        if (!destinationTeam) {
          return new Output(
            false,
            [],
            [CALENDAR_AVAILABILITY_ERROR_MESSAGES.MULTISKILL_DESTINATION_INVALID],
            null
          );
        }

        teamId = input.destinationTeamId;
        // Lead ainda está no time de origem até a transferência.
        excludeLeadTeamId = input.teamId;
      }

      const result = await this.service.getAvailability({
        teamId,
        requestedCloserIds: input.requestedCloserIds,
        date: input.date,
        days: input.days,
        excludeLeadId: input.excludeLeadId,
        excludeLeadTeamId,
        userTimezone: input.userTimezone,
      } as GetCalendarAvailabilityInput);

      return new Output(true, [], [], result);
    } catch (error) {
      if (error instanceof CalendarAvailabilityServiceError) {
        if (error.code === "CLOSERS_NOT_IN_TEAM") {
          return new Output(false, [], [CALENDAR_AVAILABILITY_ERROR_MESSAGES.CLOSERS_NOT_IN_TEAM], null);
        }

        if (error.code === "CLOSERS_NOT_FOUND") {
          return new Output(false, [], [CALENDAR_AVAILABILITY_ERROR_MESSAGES.CLOSERS_NOT_FOUND], null);
        }
      }

      console.error("[CalendarAvailabilityUseCase][getAvailability] Erro inesperado:", error);
      return new Output(false, [], [CALENDAR_AVAILABILITY_ERROR_MESSAGES.INTERNAL_ERROR], null);
    }
  }
}

export const calendarAvailabilityUseCase: ICalendarAvailabilityUseCase =
  new CalendarAvailabilityUseCase(calendarAvailabilityService);
