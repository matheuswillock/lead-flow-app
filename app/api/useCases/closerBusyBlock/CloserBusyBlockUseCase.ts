import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  closerBusyBlockService,
  toCloserBusyBlockDto,
} from "@/app/api/services/CloserBusyBlock/CloserBusyBlockService"
import type {
  ICloserBusyBlockService,
  UpsertCloserBusyBlockInput,
} from "@/app/api/services/CloserBusyBlock/ICloserBusyBlockService"
import type { CloserBusyBlockWithProfile } from "@/app/api/infra/data/repositories/closerBusyBlock/ICloserBusyBlockRepository"
import {
  cancelCalendarEvent,
  upsertBusyBlockEvent,
} from "@/app/api/services/googleCalendar/GoogleCalendarService"
import { isGoogleConnectionActive } from "@/lib/google/connection"
import { buildWeeklyRrule } from "@/lib/closer-busy-block/materialize"
import { DEFAULT_TZ, resolveTimezone } from "@/lib/dates"
import type { ICloserBusyBlockUseCase } from "./ICloserBusyBlockUseCase"

const LOG_PREFIX = "[CloserBusyBlockUseCase]"

type NormalizedRange = {
  startsAt: Date
  endsAt: Date
  weekdays: number[]
  recurrenceEndsAt: Date | null
}

async function syncGoogleForBlock(params: {
  block: CloserBusyBlockWithProfile
  syncToGoogle: boolean
  startsAt: Date
  endsAt: Date
  allDay: boolean
  isRecurring: boolean
  weekdays: number[]
  recurrenceEndsAt: Date | null
  reason: string | null
}): Promise<{ googleEventId: string | null; googleCalendarId: string | null }> {
  const {
    block,
    syncToGoogle,
    startsAt,
    endsAt,
    allDay,
    isRecurring,
    weekdays,
    recurrenceEndsAt,
    reason,
  } = params

  const timezone = resolveTimezone(block.profile.timezone || DEFAULT_TZ)
  const connection = block.profile.googleConnection
  const hasGoogle = isGoogleConnectionActive(connection)

  if (!syncToGoogle) {
    if (block.googleEventId && hasGoogle && connection) {
      try {
        await cancelCalendarEvent({
          organizer: {
            id: block.profile.id,
            supabaseId: block.profile.supabaseId,
            timezone,
            googleConnectionId: block.profile.googleConnectionId,
            googleEmail: connection.googleEmail,
          },
          eventId: block.googleEventId,
          calendarId: block.googleCalendarId ?? "primary",
        })
      } catch (error) {
        console.info(`${LOG_PREFIX} Falha ao remover evento Google antigo (ignorado)`, error)
      }
    }
    return { googleEventId: null, googleCalendarId: null }
  }

  if (!hasGoogle || !connection) {
    throw new Error(
      "O closer precisa ter o Google Calendar conectado para ocupar a agenda Google."
    )
  }

  const summary = reason?.trim()
    ? `Indisponível — ${reason.trim()}`
    : "Indisponível — Corretor Studio"

  const recurrence =
    isRecurring && recurrenceEndsAt
      ? [`RRULE:${buildWeeklyRrule(weekdays, recurrenceEndsAt, timezone)}`]
      : undefined

  const result = await upsertBusyBlockEvent({
    organizer: {
      id: block.profile.id,
      supabaseId: block.profile.supabaseId,
      timezone,
      googleConnectionId: block.profile.googleConnectionId,
      googleEmail: connection.googleEmail,
    },
    summary,
    startsAt,
    endsAt,
    allDay,
    timezone,
    recurrence,
    existingEventId: block.googleEventId,
  })

  return { googleEventId: result.eventId, googleCalendarId: result.calendarId }
}

export class CloserBusyBlockUseCase implements ICloserBusyBlockUseCase {
  constructor(private readonly service: ICloserBusyBlockService) {}

  async list(params: {
    access: TeamAccess
    from: Date
    to: Date
    closerId?: string
  }): Promise<Output> {
    return this.service.list(params)
  }

  async create(params: {
    access: TeamAccess
    input: UpsertCloserBusyBlockInput
  }): Promise<Output> {
    const output = await this.service.create(params)
    if (!output.isValid || !output.result) return output

    const { block, normalized } = output.result as {
      block: CloserBusyBlockWithProfile
      normalized: NormalizedRange
    }

    try {
      const google = await syncGoogleForBlock({
        block,
        syncToGoogle: params.input.syncToGoogle,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        allDay: params.input.allDay,
        isRecurring: params.input.isRecurring,
        weekdays: normalized.weekdays,
        recurrenceEndsAt: normalized.recurrenceEndsAt,
        reason: params.input.reason?.trim() || null,
      })

      const saved = await this.service.attachGoogleEvent(block.id, {
        googleEventId: google.googleEventId,
        googleCalendarId: google.googleCalendarId,
        syncToGoogle: params.input.syncToGoogle,
      })

      return new Output(true, ["Ocupação criada."], [], toCloserBusyBlockDto(saved))
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro no sync Google ao criar`, error)
      await this.service.remove({ access: params.access, id: block.id }).catch(() => null)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Não foi possível sincronizar com o Google Calendar."],
        null
      )
    }
  }

  async update(params: {
    access: TeamAccess
    id: string
    input: UpsertCloserBusyBlockInput
  }): Promise<Output> {
    const output = await this.service.update(params)
    if (!output.isValid || !output.result) return output

    const { block, previous, normalized } = output.result as {
      block: CloserBusyBlockWithProfile
      previous: CloserBusyBlockWithProfile
      normalized: NormalizedRange
    }

    try {
      const google = await syncGoogleForBlock({
        block: {
          ...block,
          googleEventId: previous.googleEventId,
          googleCalendarId: previous.googleCalendarId,
        },
        syncToGoogle: params.input.syncToGoogle,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        allDay: params.input.allDay,
        isRecurring: params.input.isRecurring,
        weekdays: normalized.weekdays,
        recurrenceEndsAt: normalized.recurrenceEndsAt,
        reason: params.input.reason?.trim() || null,
      })

      const saved = await this.service.attachGoogleEvent(block.id, {
        googleEventId: google.googleEventId,
        googleCalendarId: google.googleCalendarId,
        syncToGoogle: params.input.syncToGoogle,
      })

      return new Output(true, ["Ocupação atualizada."], [], toCloserBusyBlockDto(saved))
    } catch (error) {
      console.error(`${LOG_PREFIX} Erro no sync Google ao atualizar`, error)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Não foi possível sincronizar com o Google Calendar."],
        null
      )
    }
  }

  async remove(params: { access: TeamAccess; id: string }): Promise<Output> {
    const existing = await this.service.remove(params)
    if (!existing.isValid || !existing.result) return existing

    const { block } = existing.result as { id: string; block: CloserBusyBlockWithProfile }
    if (block.googleEventId && block.profile.googleConnection) {
      try {
        await cancelCalendarEvent({
          organizer: {
            id: block.profile.id,
            supabaseId: block.profile.supabaseId,
            timezone: resolveTimezone(block.profile.timezone || DEFAULT_TZ),
            googleConnectionId: block.profile.googleConnectionId,
            googleEmail: block.profile.googleConnection.googleEmail,
          },
          eventId: block.googleEventId,
          calendarId: block.googleCalendarId ?? "primary",
        })
      } catch (error) {
        console.info(`${LOG_PREFIX} Falha ao cancelar evento Google na exclusão`, error)
      }
    }

    return new Output(true, ["Ocupação excluída."], [], { id: block.id })
  }
}

export const closerBusyBlockUseCase = new CloserBusyBlockUseCase(closerBusyBlockService)
