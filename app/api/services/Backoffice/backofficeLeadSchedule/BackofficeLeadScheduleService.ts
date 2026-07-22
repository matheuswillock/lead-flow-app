import { BackofficeInviteDispatchStatus, type Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { validateMeetingLinkValue } from "@/lib/validations/meetingLink"
import type { IBackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadSchedule/IBackofficeLeadScheduleRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import type { IBackofficeGoogleCalendarService } from "../backofficeGoogleCalendar/IBackofficeGoogleCalendarService"
import type {
  CancelBackofficeLeadScheduleInput,
  GetBackofficeLeadScheduleAttendeesInput,
  IBackofficeLeadScheduleService,
  UpsertBackofficeLeadScheduleInput,
} from "./IBackofficeLeadScheduleService"
import type { IBackofficeLeadScheduleInviteService } from "./IBackofficeLeadScheduleInviteService"
import { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import type { IBackofficeGoogleConnectionResolverService } from "../backofficeGoogleConnection/IBackofficeGoogleConnectionResolverService"

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
    private readonly googleResolver: IBackofficeGoogleConnectionResolverService,
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
      const resolvedMeetingType = input.meetingType ?? "online"
      const isOnlineMeeting = resolvedMeetingType === "online"

      const closer = await this.userRepo.findById(input.closerBackofficeUserId)
      if (!closer?.isActive || !closer.isCloser) {
        return new Output(false, [], ["Closer informado não está ativo"], null)
      }

      if (isOnlineMeeting && !input.leadEmail?.trim()) {
        return new Output(
          false,
          [],
          ["Lead precisa de um e-mail para agendamento online."],
          null
        )
      }

      const existingSchedule = await this.scheduleRepo.findLatestActiveByLeadId(input.leadId)
      const organizer = await this.googleResolver.resolveForBackofficeUser(closer.id)
      const canUseGoogleCalendar = !!organizer
      const meetingLinkValidation = validateMeetingLinkValue(input.meetingLink, {
        required: isOnlineMeeting && !canUseGoogleCalendar,
      })

      if (!meetingLinkValidation.isValid) {
        if (isOnlineMeeting && !canUseGoogleCalendar && !input.meetingLink?.trim()) {
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

      if (isOnlineMeeting && organizer) {
        try {
          const calendarResult = await this.googleCalendarService.upsertEvent({
            organizer,
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

      if (isOnlineMeeting && status !== BackofficeInviteDispatchStatus.sent_google) {
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

      if (!isOnlineMeeting) {
        status = BackofficeInviteDispatchStatus.sent_resend
        provider = "resend"
        dispatchError = null
        dispatchPayload = {
          provider,
          meetingType: resolvedMeetingType,
        }

        if (input.leadEmail?.trim() || (input.extraGuests ?? []).length > 0) {
          const resendOutput = await this.inviteService.sendInvite({
            leadName: input.leadName,
            leadEmail: input.leadEmail,
            closerName: closer.email,
            closerEmail,
            meetingDate: input.meetingDate,
            meetingTitle: input.meetingTitle,
            meetingNotes: input.meetingNotes,
            meetingLink: finalMeetingLink ?? "",
            extraGuests: input.extraGuests ?? [],
            eventUid: existingSchedule?.id ?? input.leadId,
            timezone: closer.timezone,
          })
          if (resendOutput.isValid) {
            dispatchPayload = {
              provider,
              meetingType: resolvedMeetingType,
              resend: toInputJsonValue(resendOutput.result),
            }
          }
        }
      }

      const scheduleData = {
        closerBackofficeUserId: input.closerBackofficeUserId,
        date: input.meetingDate,
        meetingTitle: input.meetingTitle,
        notes: input.meetingNotes ?? null,
        meetingLink: finalMeetingLink,
        meetingType: resolvedMeetingType,
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

      // Notifica o closer por e-mail em todos os cenários (Google ou Resend)
      const lead = await this.leadRepo.findById(input.leadId)
      this.inviteService
        .sendCloserNewLeadNotification({
          closerEmail: closerEmail,
          leadName: input.leadName,
          leadEmail: input.leadEmail,
          leadPhone: lead?.phone ?? null,
          meetingDate: input.meetingDate,
          meetingTitle: input.meetingTitle,
          meetingLink: finalMeetingLink,
          timezone: closer.timezone,
        })
        .catch((err) =>
          console.error("[BackofficeLeadScheduleService][closerNotification]", err)
        )

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
        const organizer = closer
          ? await this.googleResolver.resolveForBackofficeUser(closer.id)
          : null

        if (!closer || !organizer) {
          calendarWarning = "Conta Google não conectada. Evento não foi cancelado no Google Calendar."
        } else {
          try {
            await this.googleCalendarService.cancelEvent({
              organizer,
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

  async resendInvite(input: {
    leadId: string
    target: "all" | "single" | "new"
    email?: string
    emails?: string[]
  }): Promise<Output> {
    try {
      const schedule = await this.scheduleRepo.findLatestActiveByLeadId(input.leadId)
      if (!schedule) {
        return new Output(false, [], ["Agendamento não encontrado"], null)
      }

      const lead = await this.leadRepo.findById(input.leadId)
      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }

      const closer = schedule.closerBackofficeUserId
        ? await this.userRepo.findById(schedule.closerBackofficeUserId)
        : null
      if (!closer?.email) {
        return new Output(false, [], ["Closer do agendamento sem e-mail válido"], null)
      }

      const closerEmail = normalizeEmail(closer.email)
      if (!closerEmail) {
        return new Output(false, [], ["Closer do agendamento sem e-mail válido"], null)
      }

      let recipients: string[] = []
      if (input.target === "all") {
        recipients = [
          ...(lead.email ? [lead.email] : []),
          closerEmail,
          ...schedule.extraGuests,
        ]
      } else if (input.target === "single") {
        if (!input.email?.trim()) {
          return new Output(false, [], ["Informe o e-mail para reenvio"], null)
        }
        recipients = [input.email]
      } else {
        const emails = input.emails?.filter((item) => !!item.trim()) ?? []
        if (emails.length === 0) {
          return new Output(false, [], ["Informe ao menos um e-mail para reenvio"], null)
        }
        recipients = emails
      }

      const uniqueRecipients = Array.from(
        new Set(recipients.map((email) => email.trim().toLowerCase()).filter(Boolean))
      )
      if (uniqueRecipients.length === 0) {
        return new Output(false, [], ["Nenhum destinatário válido para reenvio"], null)
      }

      const meetingLink = schedule.meetingLink ?? lead.meetingLink ?? ""
      if (!meetingLink.trim() && (schedule.meetingType ?? lead.meetingType ?? "online") === "online") {
        return new Output(false, [], ["Agendamento online sem link para reenvio"], null)
      }
      const attemptedAt = new Date()
      const resendOutput = await this.inviteService.sendInvite({
        leadName: lead.name,
        leadEmail: uniqueRecipients[0],
        closerName: closer.email,
        closerEmail,
        meetingDate: schedule.date,
        meetingTitle: schedule.meetingTitle ?? lead.meetingTitle ?? `Reunião — ${lead.name}`,
        meetingNotes: schedule.notes ?? lead.meetingNotes,
        meetingLink,
        extraGuests: uniqueRecipients.slice(1),
        eventUid: schedule.id,
        timezone: closer.timezone,
      })

      if (!resendOutput.isValid) {
        await this.scheduleRepo.update(schedule.id, {
          inviteDispatchStatus: BackofficeInviteDispatchStatus.failed,
          inviteDispatchProvider: "resend",
          inviteDispatchLastAttemptAt: attemptedAt,
          inviteDispatchLastError: resendOutput.errorMessages.join("; ") || "Falha no reenvio",
          inviteDispatchLastPayload: toInputJsonValue(resendOutput.result),
        })
        return resendOutput
      }

      await this.scheduleRepo.update(schedule.id, {
        inviteDispatchStatus: BackofficeInviteDispatchStatus.sent_resend,
        inviteDispatchProvider: "resend",
        inviteDispatchLastAttemptAt: attemptedAt,
        inviteDispatchLastError: null,
        inviteDispatchLastPayload: toInputJsonValue(resendOutput.result),
      })

      return new Output(true, ["Convite reenviado com sucesso"], [], {
        recipients: uniqueRecipients,
        inviteDispatch: resendOutput.result,
      })
    } catch (error) {
      console.error("[BackofficeLeadScheduleService][resendInvite]", error)
      return new Output(false, [], ["Erro ao reenviar convite do agendamento"], null)
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

      const organizer = closer
        ? await this.googleResolver.resolveForBackofficeUser(closer.id)
        : null
      const canUseGoogle = !!schedule.googleEventId && !!organizer

      if (canUseGoogle && organizer) {
        try {
          const attendees = await this.googleCalendarService.getEventAttendees({
            organizer,
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
