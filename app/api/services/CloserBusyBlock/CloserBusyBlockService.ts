import { closerBusyBlockRepository } from "@/app/api/infra/data/repositories/closerBusyBlock/CloserBusyBlockRepository"
import type { CloserBusyBlockWithProfile } from "@/app/api/infra/data/repositories/closerBusyBlock/ICloserBusyBlockRepository"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerOrMaster } from "@/app/api/v1/utils/teamAccess"
import {
  materializeBusyBlockOccurrences,
} from "@/lib/closer-busy-block/materialize"
import {
  DEFAULT_TZ,
  endOfDayInTz,
  formatLocalDateValue,
  parseDateKeyToUtc,
  resolveTimezone,
  startOfDayInTz,
} from "@/lib/dates"
import { Output } from "@/lib/output"
import type {
  CloserBusyBlockDto,
  ICloserBusyBlockService,
  UpsertCloserBusyBlockInput,
} from "./ICloserBusyBlockService"

const LOG_PREFIX = "[CloserBusyBlockService]"

export class CloserBusyBlockServiceError extends Error {
  constructor(
    public readonly code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION",
    message: string
  ) {
    super(message)
    this.name = "CloserBusyBlockServiceError"
  }
}

function canManageProfile(access: TeamAccess, profileId: string): boolean {
  if (isManagerOrMaster(access)) return true
  return access.profileId === profileId
}

export function toCloserBusyBlockDto(
  block: CloserBusyBlockWithProfile,
  occurrence?: { startsAt: Date; endsAt: Date }
): CloserBusyBlockDto {
  return {
    id: block.id,
    teamId: block.teamId,
    profileId: block.profileId,
    closerName: block.profile.fullName,
    closerEmail: block.profile.email,
    startsAt: block.startsAt.toISOString(),
    endsAt: block.endsAt.toISOString(),
    allDay: block.allDay,
    isRecurring: block.isRecurring,
    weekdays: block.weekdays,
    recurrenceEndsAt: block.recurrenceEndsAt?.toISOString() ?? null,
    syncToGoogle: block.syncToGoogle,
    googleEventId: block.googleEventId,
    reason: block.reason,
    createdByProfileId: block.createdByProfileId,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
    ...(occurrence
      ? {
          occurrenceStartsAt: occurrence.startsAt.toISOString(),
          occurrenceEndsAt: occurrence.endsAt.toISOString(),
        }
      : {}),
  }
}

function normalizeRange(input: UpsertCloserBusyBlockInput, timezone: string) {
  const startsAtRaw = new Date(input.startsAt)
  const endsAtRaw = new Date(input.endsAt)

  if (Number.isNaN(startsAtRaw.getTime()) || Number.isNaN(endsAtRaw.getTime())) {
    throw new CloserBusyBlockServiceError("VALIDATION", "Datas de início e fim inválidas.")
  }

  let startsAt = startsAtRaw
  let endsAt = endsAtRaw

  if (input.allDay) {
    const startKey = formatLocalDateValue(startsAtRaw, timezone)
    const endKey = formatLocalDateValue(endsAtRaw, timezone)
    startsAt = startOfDayInTz(parseDateKeyToUtc(startKey, timezone), timezone)
    const endDayStart = startOfDayInTz(parseDateKeyToUtc(endKey, timezone), timezone)
    endsAt = new Date(endOfDayInTz(endDayStart, timezone).getTime() + 1)
  }

  if (endsAt <= startsAt) {
    throw new CloserBusyBlockServiceError("VALIDATION", "A data/hora de fim deve ser posterior ao início.")
  }

  const weekdays = input.isRecurring
    ? [...new Set(input.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : []

  if (input.isRecurring && weekdays.length === 0) {
    throw new CloserBusyBlockServiceError(
      "VALIDATION",
      "Selecione ao menos um dia da semana para recorrência."
    )
  }

  let recurrenceEndsAt: Date | null = null
  if (input.isRecurring) {
    if (!input.recurrenceEndsAt) {
      throw new CloserBusyBlockServiceError(
        "VALIDATION",
        "Informe a data final da recorrência."
      )
    }
    recurrenceEndsAt = endOfDayInTz(new Date(input.recurrenceEndsAt), timezone)
    if (Number.isNaN(recurrenceEndsAt.getTime()) || recurrenceEndsAt < startsAt) {
      throw new CloserBusyBlockServiceError(
        "VALIDATION",
        "A data final da recorrência deve ser igual ou posterior ao início."
      )
    }
  }

  return { startsAt, endsAt, weekdays, recurrenceEndsAt }
}

export class CloserBusyBlockService implements ICloserBusyBlockService {
  async list(params: {
    access: TeamAccess
    from: Date
    to: Date
    closerId?: string
  }): Promise<Output> {
    const { access, from, to, closerId } = params

    if (closerId && !canManageProfile(access, closerId)) {
      return new Output(false, [], ["Sem permissão para ver ocupações deste closer."], null)
    }

    const profileIds = closerId
      ? [closerId]
      : isManagerOrMaster(access)
        ? undefined
        : [access.profileId]

    const blocks = await closerBusyBlockRepository.findOverlapping({
      teamId: access.teamId,
      profileIds,
      rangeStart: from,
      rangeEnd: to,
    })

    const result: CloserBusyBlockDto[] = []
    for (const block of blocks) {
      const timezone = resolveTimezone(block.profile.timezone || access.userTimezone)
      const occurrences = materializeBusyBlockOccurrences(
        {
          id: block.id,
          profileId: block.profileId,
          startsAt: block.startsAt,
          endsAt: block.endsAt,
          allDay: block.allDay,
          isRecurring: block.isRecurring,
          weekdays: block.weekdays,
          recurrenceEndsAt: block.recurrenceEndsAt,
        },
        from,
        to,
        timezone
      )

      if (occurrences.length === 0) {
        result.push(toCloserBusyBlockDto(block))
        continue
      }

      for (const occurrence of occurrences) {
        result.push(toCloserBusyBlockDto(block, occurrence))
      }
    }

    return new Output(true, ["Ocupações carregadas."], [], result)
  }

  async create(params: {
    access: TeamAccess
    input: UpsertCloserBusyBlockInput
  }): Promise<Output> {
    const { access, input } = params

    if (!canManageProfile(access, input.profileId)) {
      return new Output(false, [], ["Sem permissão para marcar ocupação deste closer."], null)
    }

    const inTeam = await closerBusyBlockRepository.isCloserInTeam(access.teamId, input.profileId)
    if (!inTeam) {
      return new Output(false, [], ["Closer não pertence ao time ativo."], null)
    }

    const timezone =
      resolveTimezone(
        (await closerBusyBlockRepository.findProfileTimezone(input.profileId)) ?? access.userTimezone
      ) || DEFAULT_TZ

    try {
      const normalized = normalizeRange(input, timezone)
      const created = await closerBusyBlockRepository.create({
        teamId: access.teamId,
        profileId: input.profileId,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        allDay: input.allDay,
        isRecurring: input.isRecurring,
        weekdays: normalized.weekdays,
        recurrenceEndsAt: normalized.recurrenceEndsAt,
        syncToGoogle: input.syncToGoogle,
        reason: input.reason?.trim() || null,
        createdByProfileId: access.profileId,
      })

      return new Output(true, ["Ocupação criada."], [], {
        block: created,
        normalized,
      })
    } catch (error) {
      if (error instanceof CloserBusyBlockServiceError) {
        return new Output(false, [], [error.message], { code: error.code })
      }
      console.error(`${LOG_PREFIX} Erro ao criar ocupação`, error)
      return new Output(false, [], ["Erro ao criar ocupação."], null)
    }
  }

  async update(params: {
    access: TeamAccess
    id: string
    input: UpsertCloserBusyBlockInput
  }): Promise<Output> {
    const { access, id, input } = params
    const existing = await closerBusyBlockRepository.findById(id)

    if (!existing || existing.teamId !== access.teamId) {
      return new Output(false, [], ["Ocupação não encontrada."], null)
    }

    if (!canManageProfile(access, existing.profileId) || !canManageProfile(access, input.profileId)) {
      return new Output(false, [], ["Sem permissão para editar esta ocupação."], null)
    }

    if (input.profileId !== existing.profileId) {
      return new Output(false, [], ["Não é permitido alterar o closer da ocupação."], null)
    }

    const timezone = resolveTimezone(existing.profile.timezone || access.userTimezone) || DEFAULT_TZ

    try {
      const normalized = normalizeRange(input, timezone)
      const updated = await closerBusyBlockRepository.update(id, {
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        allDay: input.allDay,
        isRecurring: input.isRecurring,
        weekdays: normalized.weekdays,
        recurrenceEndsAt: normalized.recurrenceEndsAt,
        syncToGoogle: input.syncToGoogle,
        reason: input.reason?.trim() || null,
      })

      return new Output(true, ["Ocupação atualizada."], [], {
        block: updated,
        previous: existing,
        normalized,
      })
    } catch (error) {
      if (error instanceof CloserBusyBlockServiceError) {
        return new Output(false, [], [error.message], { code: error.code })
      }
      console.error(`${LOG_PREFIX} Erro ao atualizar ocupação`, error)
      return new Output(false, [], ["Erro ao atualizar ocupação."], null)
    }
  }

  async remove(params: { access: TeamAccess; id: string }): Promise<Output> {
    const { access, id } = params
    const existing = await closerBusyBlockRepository.findById(id)

    if (!existing || existing.teamId !== access.teamId) {
      return new Output(false, [], ["Ocupação não encontrada."], null)
    }

    if (!canManageProfile(access, existing.profileId)) {
      return new Output(false, [], ["Sem permissão para excluir esta ocupação."], null)
    }

    await closerBusyBlockRepository.delete(id)
    return new Output(true, ["Ocupação excluída."], [], { id, block: existing })
  }

  async attachGoogleEvent(
    id: string,
    google: { googleEventId: string | null; googleCalendarId: string | null; syncToGoogle: boolean }
  ): Promise<CloserBusyBlockWithProfile> {
    return closerBusyBlockRepository.update(id, google)
  }
}

export const closerBusyBlockService = new CloserBusyBlockService()
