import { randomUUID } from "node:crypto"
import { BackofficeLeadOrigin, BackofficeLeadStatus } from "@prisma/client"
import { DEFAULT_TZ, formatLocalDateValue, formatLocalTimeValue } from "@/lib/dates"
import { Output } from "@/lib/output"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import { backofficeLeadSlackNotificationService } from "@/app/api/services/backofficeLeadSlack/BackofficeLeadSlackNotificationService"
import type { IBackofficeLeadScheduleService } from "@/app/api/services/Backoffice/backofficeLeadSchedule/IBackofficeLeadScheduleService"
import { backofficeCalendarAvailabilityUseCase } from "@/app/api/useCases/backofficeCalendarAvailability/BackofficeCalendarAvailabilityUseCase"
import type { IBackofficeCalendarAvailabilityUseCase } from "@/app/api/useCases/backofficeCalendarAvailability/IBackofficeCalendarAvailabilityUseCase"
import { backofficeLeadScheduleService } from "@/app/api/useCases/backofficeLeadSchedule/backofficeLeadScheduleService"
import type {
  CreatePublicBackofficeLeadFormInput,
  IBackofficePublicLeadFormUseCase,
} from "./IBackofficePublicLeadFormUseCase"

function nullIfEmpty(value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildSourceExternalId(input: CreatePublicBackofficeLeadFormInput): string | null {
  const email = nullIfEmpty(input.email)?.toLowerCase()
  if (email) return `public_form:${email}`

  const phoneDigits = nullIfEmpty(input.phone)?.replace(/\D/g, "")
  if (phoneDigits) return `public_form:phone:${phoneDigits}`

  return null
}

function buildTrackingNotes(input: CreatePublicBackofficeLeadFormInput): string | null {
  const lines = [
    "Lead criado via formulário público do backoffice.",
    nullIfEmpty(input.notes),
    input.utmSource ? `utm_source: ${input.utmSource}` : null,
    input.utmMedium ? `utm_medium: ${input.utmMedium}` : null,
    input.utmCampaign ? `utm_campaign: ${input.utmCampaign}` : null,
    input.utmContent ? `utm_content: ${input.utmContent}` : null,
    input.utmTerm ? `utm_term: ${input.utmTerm}` : null,
    input.landingUrl ? `landing_url: ${input.landingUrl}` : null,
    input.referrer ? `referrer: ${input.referrer}` : null,
  ].filter((item): item is string => Boolean(item))

  return lines.length > 0 ? lines.join("\n") : null
}

export class BackofficePublicLeadFormUseCase implements IBackofficePublicLeadFormUseCase {
  constructor(
    private readonly leadRepository: IBackofficeLeadRepository,
    private readonly scheduleService: IBackofficeLeadScheduleService = backofficeLeadScheduleService,
    private readonly userRepository: IBackofficeUserRepository = new BackofficeUserRepository(),
    private readonly availabilityUseCase: IBackofficeCalendarAvailabilityUseCase = backofficeCalendarAvailabilityUseCase
  ) {}

  private async assertMeetingSlotAvailable(params: {
    closerBackofficeUserId: string
    meetingDate: Date
    excludeLeadId?: string
  }): Promise<Output> {
    if (Number.isNaN(params.meetingDate.getTime()) || params.meetingDate.getTime() < Date.now() - 60_000) {
      return new Output(false, [], ["Horário de agendamento inválido ou já passou"], null)
    }

    const closer = await this.userRepository.findById(params.closerBackofficeUserId)
    if (!closer?.isActive || !closer.isCloser) {
      return new Output(false, [], ["Closer informado não está disponível"], null)
    }

    const timezone = closer.timezone?.trim() || DEFAULT_TZ
    const dateKey = formatLocalDateValue(params.meetingDate, timezone)
    const timeKey = formatLocalTimeValue(params.meetingDate, timezone)

    const availabilityOutput = await this.availabilityUseCase.getAvailability({
      closerIds: [params.closerBackofficeUserId],
      date: dateKey,
      days: 1,
      excludeLeadId: params.excludeLeadId,
      userTimezone: timezone,
    })

    if (!availabilityOutput.isValid) {
      return availabilityOutput
    }

    const availableTimes =
      (availabilityOutput.result as { availableTimes?: string[] } | null)?.availableTimes ?? []

    if (!availableTimes.includes(timeKey)) {
      return new Output(false, [], ["O horário selecionado não está mais disponível"], null)
    }

    return new Output(true, [], [], null)
  }

  private async applySchedule(params: {
    leadId: string
    leadName: string
    leadEmail: string | null
    closerBackofficeUserId: string
    meetingDate: Date
    meetingTitle: string
    meetingNotes: string | null
    meetingType: "online" | "call" | "whatsapp"
  }): Promise<Output> {
    const slotCheck = await this.assertMeetingSlotAvailable({
      closerBackofficeUserId: params.closerBackofficeUserId,
      meetingDate: params.meetingDate,
      excludeLeadId: params.leadId,
    })
    if (!slotCheck.isValid) return slotCheck

    const scheduleOutput = await this.scheduleService.upsertSchedule({
      leadId: params.leadId,
      leadName: params.leadName,
      leadEmail: params.leadEmail,
      closerBackofficeUserId: params.closerBackofficeUserId,
      meetingDate: params.meetingDate,
      meetingTitle: params.meetingTitle,
      meetingNotes: params.meetingNotes,
      meetingType: params.meetingType,
      createdByProfileId: null,
    })

    if (!scheduleOutput.isValid) return scheduleOutput

    const scheduleResult = scheduleOutput.result as {
      meetingLink?: string | null
      schedule?: { meetingType?: string | null }
    } | null

    if (params.leadEmail) {
      await this.leadRepository.update(params.leadId, {
        email: params.leadEmail,
      })
    }

    const lead = await this.leadRepository.updateStatus(params.leadId, {
      status: BackofficeLeadStatus.scheduled,
      closerBackofficeUserId: params.closerBackofficeUserId,
      meetingDate: params.meetingDate,
      meetingTitle: params.meetingTitle,
      meetingNotes: params.meetingNotes,
      meetingLink: scheduleResult?.meetingLink ?? null,
      meetingType: scheduleResult?.schedule?.meetingType ?? params.meetingType,
    })

    return new Output(true, scheduleOutput.successMessages, [], {
      lead,
      schedule: scheduleOutput.result,
    })
  }

  async create(input: CreatePublicBackofficeLeadFormInput): Promise<Output> {
    try {
      const name = input.name.trim()
      const email = nullIfEmpty(input.email)
      const phone = nullIfEmpty(input.phone)
      const wantsSchedule = Boolean(input.closerBackofficeUserId && input.meetingDate)

      if (!email && !phone) {
        return new Output(false, [], ["Informe e-mail ou telefone."], null)
      }

      if (wantsSchedule && !email) {
        return new Output(
          false,
          [],
          ["E-mail é obrigatório para agendar a demonstração."],
          null
        )
      }

      const meetingType = input.meetingType ?? "online"
      const meetingDate = input.meetingDate ? new Date(input.meetingDate) : null
      const meetingTitle =
        nullIfEmpty(input.meetingTitle) ?? `Demonstração Corretor Studio - ${name}`
      const meetingNotes = nullIfEmpty(input.meetingNotes)

      const sourceExternalId = buildSourceExternalId(input)
      if (sourceExternalId) {
        const existing = await this.leadRepository.findBySourceExternalId(sourceExternalId)
        if (existing) {
          if (wantsSchedule && meetingDate && input.closerBackofficeUserId) {
            const scheduleApply = await this.applySchedule({
              leadId: existing.id,
              leadName: existing.name || name,
              leadEmail: email ?? existing.email,
              closerBackofficeUserId: input.closerBackofficeUserId,
              meetingDate,
              meetingTitle,
              meetingNotes,
              meetingType,
            })

            if (!scheduleApply.isValid) return scheduleApply

            const scheduledLead =
              (scheduleApply.result as { lead?: typeof existing } | null)?.lead ?? existing

            await backofficeLeadSlackNotificationService.sendLeadCreatedEventBestEffort({
              lead: scheduledLead,
              title: "Lead existente reagendado via formulário público",
              force: true,
            })

            return new Output(true, ["Agendamento atualizado para lead existente"], [], {
              id: scheduledLead.id,
              duplicated: true,
              scheduled: true,
              meetingDate: scheduledLead.meetingDate?.toISOString() ?? meetingDate.toISOString(),
            })
          }

          await backofficeLeadSlackNotificationService.sendLeadCreatedEventBestEffort({
            lead: existing,
            title: "Novo lead via formulário público (lead existente)",
            force: true,
          })

          return new Output(true, ["Lead já existente para este formulário público"], [], {
            id: existing.id,
            duplicated: true,
            scheduled: false,
            meetingDate: existing.meetingDate?.toISOString() ?? null,
          })
        }
      }

      let lead = await this.leadRepository.create({
        id: randomUUID(),
        name,
        email,
        phone,
        cpfCnpj: nullIfEmpty(input.cpfCnpj),
        notes: buildTrackingNotes(input),
        status: wantsSchedule
          ? BackofficeLeadStatus.scheduled
          : BackofficeLeadStatus.new_opportunity,
        origin: "public_form" as unknown as BackofficeLeadOrigin,
        sourceExternalId,
        closerBackofficeUserId: wantsSchedule ? input.closerBackofficeUserId : null,
        meetingDate: wantsSchedule ? meetingDate : null,
        meetingTitle: wantsSchedule ? meetingTitle : null,
        meetingNotes: wantsSchedule ? meetingNotes : null,
        meetingType: wantsSchedule ? meetingType : null,
        createdByProfileId: null,
        qualificationLeadOrganization: nullIfEmpty(input.qualificationLeadOrganization),
        qualificationAvgUsers: nullIfEmpty(input.qualificationAvgUsers),
        qualificationProfileFit: nullIfEmpty(input.qualificationProfileFit),
      })

      if (wantsSchedule && meetingDate && input.closerBackofficeUserId) {
        const scheduleApply = await this.applySchedule({
          leadId: lead.id,
          leadName: name,
          leadEmail: email,
          closerBackofficeUserId: input.closerBackofficeUserId,
          meetingDate,
          meetingTitle,
          meetingNotes,
          meetingType,
        })

        if (!scheduleApply.isValid) {
          await this.leadRepository.delete(lead.id).catch((deleteError) =>
            console.error("[BackofficePublicLeadFormUseCase][rollback]", deleteError)
          )
          return scheduleApply
        }

        lead =
          (scheduleApply.result as { lead?: typeof lead } | null)?.lead ?? lead
      }

      console.info("[BackofficePublicLeadFormUseCase][create] Lead criado com sucesso", {
        id: lead.id,
        scheduled: wantsSchedule,
      })

      await backofficeLeadSlackNotificationService.sendLeadCreatedEventBestEffort({
        lead,
        title: wantsSchedule
          ? "Novo lead agendado via formulário público"
          : "Novo lead via formulário público",
      })

      return new Output(true, ["Lead criado com sucesso"], [], {
        id: lead.id,
        duplicated: false,
        scheduled: wantsSchedule,
        meetingDate: lead.meetingDate?.toISOString() ?? null,
      })
    } catch (error) {
      console.error("[BackofficePublicLeadFormUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar lead público"], null)
    }
  }
}

export const backofficePublicLeadFormUseCase = new BackofficePublicLeadFormUseCase(
  new BackofficeLeadRepository()
)
