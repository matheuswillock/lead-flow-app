import { Output } from "@/lib/output"
import { BackofficeCalendarAvailabilityService } from "@/app/api/services/Backoffice/backofficeCalendarAvailability/BackofficeCalendarAvailabilityService"
import type { IBackofficeCalendarAvailabilityService } from "@/app/api/services/Backoffice/backofficeCalendarAvailability/IBackofficeCalendarAvailabilityService"
import type {
  GetBackofficeCalendarAvailabilityUseCaseInput,
  IBackofficeCalendarAvailabilityUseCase,
} from "./IBackofficeCalendarAvailabilityUseCase"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import { BackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadSchedule/BackofficeLeadScheduleRepository"
import { backofficeGoogleConnectionResolverService } from "@/app/api/services/Backoffice/backofficeGoogleConnection/BackofficeGoogleConnectionResolverService"
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

      const days = Math.min(Math.max(input.days ?? 1, 1), 30)
      if (days === 1) {
        const result = await this.service.getAvailability({
          closerIds,
          date: input.date,
          excludeLeadId: input.excludeLeadId,
          userTimezone: input.userTimezone,
        })
        return new Output(true, [], [], result)
      }

      const availableDateKeys: string[] = []
      const availabilityByDay: Record<
        string,
        Awaited<ReturnType<typeof this.service.getAvailability>>
      > = {}
      const baseDate = new Date(`${input.date}T12:00:00.000Z`)

      for (let offset = 0; offset < days; offset += 1) {
        const cursor = new Date(baseDate)
        cursor.setUTCDate(baseDate.getUTCDate() + offset)
        const dateKey = cursor.toISOString().slice(0, 10)
        const dayResult = await this.service.getAvailability({
          closerIds,
          date: dateKey,
          excludeLeadId: input.excludeLeadId,
          userTimezone: input.userTimezone,
        })
        availabilityByDay[dateKey] = dayResult
        if (dayResult.availableTimes.length > 0) {
          availableDateKeys.push(dateKey)
        }
      }

      const firstDay = availabilityByDay[input.date]
      return new Output(true, [], [], {
        availableTimes: firstDay?.availableTimes ?? [],
        source: firstDay?.source ?? "internal",
        perCloser: firstDay?.perCloser ?? {},
        availableDateKeys,
        availabilityByDay,
      })
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
      backofficeGoogleConnectionResolverService,
      new BackofficeLeadScheduleRepository(),
      backofficeGoogleCalendarService
    )
  )
