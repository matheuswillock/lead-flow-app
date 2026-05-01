import { Output } from "@/lib/output"
import { BackofficeCalendarAvailabilityService } from "@/app/api/services/Backoffice/backofficeCalendarAvailability/BackofficeCalendarAvailabilityService"
import type { IBackofficeCalendarAvailabilityService } from "@/app/api/services/Backoffice/backofficeCalendarAvailability/IBackofficeCalendarAvailabilityService"
import type {
  GetBackofficeCalendarAvailabilityUseCaseInput,
  IBackofficeCalendarAvailabilityUseCase,
} from "./IBackofficeCalendarAvailabilityUseCase"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import { BackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadSchedule/BackofficeLeadScheduleRepository"
import {
  backofficeGoogleCalendarService,
} from "@/app/api/services/Backoffice/backofficeGoogleCalendar/BackofficeGoogleCalendarService"

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

export class BackofficeCalendarAvailabilityUseCase
  implements IBackofficeCalendarAvailabilityUseCase
{
  constructor(private readonly service: IBackofficeCalendarAvailabilityService) {}

  async getAvailability(
    input: GetBackofficeCalendarAvailabilityUseCaseInput
  ): Promise<Output> {
    try {
      const closerIds = Array.from(new Set(input.closerIds.filter(Boolean)))
      if (closerIds.length === 0) {
        return new Output(false, [], ["Informe ao menos um closer"], null)
      }

      if (!DATE_KEY_REGEX.test(input.date)) {
        return new Output(false, [], ["Data inválida"], null)
      }

      const result = await this.service.getAvailability({
        closerIds,
        date: input.date,
        excludeLeadId: input.excludeLeadId,
        userTimezone: input.userTimezone,
      })

      return new Output(true, [], [], result)
    } catch (error) {
      if (error instanceof Error && error.message === "CLOSERS_NOT_FOUND") {
        return new Output(false, [], ["Closers não encontrados"], null)
      }

      console.error("[BackofficeCalendarAvailabilityUseCase][getAvailability]", error)
      return new Output(false, [], ["Erro ao buscar disponibilidade"], null)
    }
  }
}

export const backofficeCalendarAvailabilityUseCase =
  new BackofficeCalendarAvailabilityUseCase(
    new BackofficeCalendarAvailabilityService(
      new BackofficeUserRepository(),
      new BackofficeLeadScheduleRepository(),
      backofficeGoogleCalendarService
    )
  )
