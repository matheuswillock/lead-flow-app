import { BackofficeInviteDispatchStatus, type Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficeUserRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficeUserRepository"
import type { IBackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backofficeLeadSchedule/IBackofficeLeadScheduleRepository"
import {
  BackofficeLeadScheduleRepository,
} from "@/app/api/infra/data/repositories/backofficeLeadSchedule/BackofficeLeadScheduleRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backofficeLead/IBackofficeLeadRepository"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backofficeLead/BackofficeLeadRepository"
import type { IBackofficeGoogleCalendarService } from "@/app/api/services/backofficeGoogleCalendar/IBackofficeGoogleCalendarService"
import {
  backofficeGoogleCalendarService,
} from "@/app/api/services/backofficeGoogleCalendar/BackofficeGoogleCalendarService"
import {
  backofficeLeadScheduleInviteService,
} from "./BackofficeLeadScheduleInviteService"
import type {
  CancelBackofficeLeadScheduleInput,
  GetBackofficeLeadScheduleAttendeesInput,
  IBackofficeLeadScheduleService,
  UpsertBackofficeLeadScheduleInput,
} from "./IBackofficeLeadScheduleService"
import type { IBackofficeLeadScheduleInviteService } from "./IBackofficeLeadScheduleInviteService"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function normalizeEmail(value?: string | null) {
  const email = value?.trim().toLowerCase()
  return email || null
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}

export class BackofficeLeadScheduleService
  implements IBackofficeLeadScheduleService
{
  constructor(
    private readonly scheduleRepo: IBackofficeLeadScheduleRepository,
    private readonly userRepo: IBackofficeUserRepository,
    private readonly leadRepo: IBackofficeLeadRepository,
    private readonly googleCalendarService: IBackofficeGoogleCalendarService,
    private readonly inviteService: IBackofficeLeadScheduleInviteService
  ) {}

  async listSchedules(leadId: string): Promise<Output> {
    try {
      const lead = await this.leadRepo.findById(leadId)
      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }

      const schedules = await this.scheduleRepo.findByLeadId(leadId)
      return new Output(true, [], [], schedules)
    } catch (error) {
      console.error("[BackofficeLeadScheduleService][listSchedules]", error)
      return new Output(false, [], ["Erro ao listar agendamentos do lead"], null)
    }
  }

  async upsertSchedule(input: UpsertBackofficeLeadScheduleInput): Promise<Output> {
    try {
      const closer = await this.userRepo.findById(input.closerBackofficeUserId)
      if (!closer?.isActive || !closer.isCloser) {
        return new Output(false, [], ["Closer informado não está ativo"], null)
      }

      const existingSchedule = await this.scheduleRepo.findLatestActiveByLeadId(input.leadId)
      const canUseGoogleCalendar =
        closer.googleCalendarConnected === true && !!closer.googleRefreshToken
      const meetingLinkValidation = validateMeetingLinkValue(input.meetingLink, {
        required: !canUseGoogleCalendar,
      })

      if (!meetingLinkValidation.isValid) {
        if (!canUseGoogleCalendar && !input.meetingLink?.trim()) {
          return new Output(
            false,
            [],
            ["Closer sem Google conectado. Informe um link manual da reunião para continuar."],
            null
          )
        }

        return new Output(false, [], [meetingLinkValidation.error], null)
      }

      const normalizedMeetingLink = meetingLinkValidation.normalized ?? null
      const attemptedAt = new Date()
      const closerEmail = normalizeEmail(closer.email)
      if (!closerEmail) {
        return new Output(false, [], ["Closer sem e-mail válido"], null)
      }

      let provider: "google" | "resend" = "resend"
      let status: BackofficeInviteDispatchStatus = BackofficeInviteDispatchStatus.failed
      let fallbackUsed = false
      let dispatchError: string | null = null
      let googleEventId: string | null = existingSchedule?.googleEventId ?? null
      let googleCalendarId: string | null = existingSchedule?.googleCalendarId ?? null
      let finalMeetingLink = normalizedMeetingLink
      let dispatchPayload: Prisma.InputJsonValue | null = null

      if (canUseGoogleCalendar) {
        try {
          const calendarResult = await this.googleCalendarService.upsertEvent({
            organizer: closer,
            leadId: input.leadId,
            leadName: input.leadName,
            leadEmail: input.leadEmail,
            closerEmail,
            meetingDate: input.meetingDate,
            meetingTitle: input.meetingTitle,
            meetingNotes: input.meetingNotes,
            meetingLink: normalizedMeetingLink,
            extraGuests: input.extraGuests ?? [],
            existingEventId: existingSchedule?.googleEventId ?? null,
          })

          provider = "google"
          status = BackofficeInviteDispatchStatus.sent_google
          googleEventId = calendarResult.eventId
          googleCalendarId = calendarResult.calendarId
          finalMeetingLink =
            normalizedMeetingLink || calendarResult.meetLink || calendarResult.htmlLink || null
          dispatchPayload = {
            provider,
            eventId: googleEventId,
            calendarId: googleCalendarId,
            htmlLink: calendarResult.htmlLink,
            meetLink: calendarResult.meetLink,
          }
        } catch (error) {
          dispatchError = getErrorMessage(error, "Falha ao criar evento no Google Calendar")
          fallbackUsed = true
          console.error("[BackofficeLeadScheduleService][Google]", {
            leadId: input.leadId,
            closerBackofficeUserId: input.closerBackofficeUserId,
            error: dispatchError,
          })
        }
      }

      if (status !== BackofficeInviteDispatchStatus.sent_google) {
        if (!finalMeetingLink?.trim()) {
          return new Output(
            false,
            [],
            ["Não foi possível concluir o agendamento sem um link válido da reunião."],
            null
          )
        }

        const resendOutput = await this.inviteService.sendInvite({
          leadName: input.leadName,
          leadEmail: input.leadEmail,
          closerName: closer.email,
          closerEmail,
          meetingDate: input.meetingDate,
          meetingTitle: input.meetingTitle,
          meetingNotes: input.meetingNotes,
          meetingLink: finalMeetingLink,
          extraGuests: input.extraGuests ?? [],
          eventUid: existingSchedule?.id ?? input.leadId,
          timezone: closer.timezone,
        })

        if (!resendOutput.isValid) {
          return resendOutput
        }

        provider = "resend"
        status = BackofficeInviteDispatchStatus.sent_resend
        dispatchError = null
        dispatchPayload = {
          provider,
          fallbackUsed,
          resend: toInputJsonValue(resendOutput.result),
        }
      }

      const scheduleData = {
        closerBackofficeUserId: input.closerBackofficeUserId,
        date: input.meetingDate,
        meetingTitle: input.meetingTitle,
        notes: input.meetingNotes ?? null,
        meetingLink: finalMeetingLink,
        extraGuests: input.extraGuests ?? [],
        googleEventId,
        googleCalendarId,
        inviteDispatchStatus: status,
        inviteDispatchProvider: provider,
        inviteDispatchFallbackUsed: fallbackUsed,
        inviteDispatchLastAttemptAt: attemptedAt,
        inviteDispatchLastError: dispatchError,
        inviteDispatchLastPayload: dispatchPayload,
      }

      const schedule = existingSchedule
        ? await this.scheduleRepo.update(existingSchedule.id, scheduleData)
        : await this.scheduleRepo.create({
            leadId: input.leadId,
            createdByProfileId: input.createdByProfileId,
            ...scheduleData,
          })

      return new Output(
        true,
        [existingSchedule ? "Agendamento atualizado com sucesso" : "Agendamento criado com sucesso"],
        [],
        {
          schedule,
          meetingLink: finalMeetingLink,
          inviteDispatch: {
            status,
            provider,
            fallbackUsed,
            error: dispatchError,
          },
        }
      )
    } catch (error) {
      console.error("[BackofficeLeadScheduleService][upsertSchedule]", error)
      return new Output(false, [], ["Erro ao salvar agendamento do backoffice"], null)
    }
  }

  async cancelSchedule(input: CancelBackofficeLeadScheduleInput): Promise<Output> {
    try {
      const schedule = await this.scheduleRepo.findLatestActiveByLeadId(input.leadId)
      if (!schedule) {
        return new Output(false, [], ["Agendamento não encontrado"], null)
      }

      let calendarWarning: string | null = null
      if (schedule.googleEventId && schedule.closerBackofficeUserId) {
        const closer = await this.userRepo.findById(schedule.closerBackofficeUserId)
        const canUseGoogleCalendar =
          !!closer?.googleCalendarConnected && !!closer.googleRefreshToken

        if (!closer || !canUseGoogleCalendar) {
          calendarWarning = "Conta Google não conectada. Evento não foi cancelado no Google Calendar."
        } else {
          try {
            await this.googleCalendarService.cancelEvent({
              organizer: closer,
              eventId: schedule.googleEventId,
              calendarId: schedule.googleCalendarId ?? "primary",
            })
          } catch (error) {
            calendarWarning = getErrorMessage(error, "Falha ao cancelar evento no Google Calendar")
            console.warn("[BackofficeLeadScheduleService][cancelSchedule]", calendarWarning)
          }
        }
      }

      await this.scheduleRepo.markCanceled(schedule.id, {
        canceledByProfileId: input.canceledByProfileId,
        cancelReason: input.reason,
      })

      const successMessages = ["Agendamento cancelado com sucesso"]
      if (calendarWarning) {
        successMessages.push("Aviso: evento no Google Calendar não foi removido.")
      }

      return new Output(true, successMessages, [], { calendarWarning })
    } catch (error) {
      console.error("[BackofficeLeadScheduleService][cancelSchedule]", error)
      return new Output(false, [], ["Erro ao cancelar agendamento do backoffice"], null)
    }
  }

  async getAttendees(input: GetBackofficeLeadScheduleAttendeesInput): Promise<Output> {
    try {
      const schedule = await this.scheduleRepo.findLatestActiveByLeadId(input.leadId)
      if (!schedule) {
        return new Output(false, [], ["Agendamento não encontrado"], null)
      }

      const [lead, closer] = await Promise.all([
        this.leadRepo.findById(input.leadId),
        schedule.closerBackofficeUserId
          ? this.userRepo.findById(schedule.closerBackofficeUserId)
          : Promise.resolve(null),
      ])

      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }

      const canUseGoogle =
        !!schedule.googleEventId && !!closer?.googleCalendarConnected && !!closer.googleRefreshToken

      if (canUseGoogle && closer) {
        try {
          const attendees = await this.googleCalendarService.getEventAttendees({
            organizer: closer,
            eventId: schedule.googleEventId ?? "",
            calendarId: schedule.googleCalendarId ?? "primary",
          })

          return new Output(true, [], [], {
            hasGoogleData: true,
            attendees: attendees.map((attendee) => ({
              email: attendee.email,
              name: attendee.displayName,
              responseStatus: attendee.responseStatus,
              source: "google",
            })),
          })
        } catch (error) {
          console.warn("[BackofficeLeadScheduleService][getAttendees][Google]", error)
        }
      }

      const attendees = [
        lead.email
          ? {
              email: lead.email,
              name: lead.name,
              responseStatus: "needsAction",
              source: "lead",
            }
          : null,
        closer?.email
          ? {
              email: closer.email,
              name: closer.email,
              responseStatus: "needsAction",
              source: "closer",
            }
          : null,
        ...schedule.extraGuests.map((email) => ({
          email,
          name: null,
          responseStatus: "needsAction",
          source: "extra",
        })),
      ].filter(Boolean)

      return new Output(true, [], [], { hasGoogleData: false, attendees })
    } catch (error) {
      console.error("[BackofficeLeadScheduleService][getAttendees]", error)
      return new Output(false, [], ["Erro ao buscar participantes do agendamento"], null)
    }
  }
}

export const backofficeLeadScheduleService = new BackofficeLeadScheduleService(
  new BackofficeLeadScheduleRepository(),
  new BackofficeUserRepository(),
  new BackofficeLeadRepository(),
  backofficeGoogleCalendarService,
  backofficeLeadScheduleInviteService
)
