import { DEFAULT_TZ } from "@/lib/dates"
import {
  generateScheduleShareToken,
  getScheduleJoinAvailableAt,
  getScheduleShareExpiry,
  hashScheduleShareToken,
  isScheduleShareExpired,
  parseScheduleShareToken,
} from "@/lib/schedule-share"
import { getFullUrl } from "@/lib/utils/app-url"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import type { IBackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadSchedule/IBackofficeLeadScheduleRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import type {
  BackofficePublicScheduleShareResult,
  BackofficeScheduleShareSummary,
  IBackofficeScheduleShareService,
} from "./IBackofficeScheduleShareService"

const ONLINE_MEETING_TYPE = "online"

export class BackofficeScheduleShareService implements IBackofficeScheduleShareService {
  constructor(
    private readonly leadRepo: IBackofficeLeadRepository,
    private readonly scheduleRepo: IBackofficeLeadScheduleRepository,
    private readonly userRepo: IBackofficeUserRepository
  ) {}

  async createPublicShare(input: { leadId: string }): Promise<{
    publicUrl: string
    expiresAt: string
    summary: BackofficeScheduleShareSummary
  }> {
    const lead = await this.leadRepo.findById(input.leadId)
    if (!lead) {
      throw new Error("Lead não encontrado.")
    }

    const schedule = await this.scheduleRepo.findLatestActiveByLeadId(input.leadId)
    if (!schedule) {
      throw new Error("Agendamento não encontrado.")
    }

    const resolvedMeetingType = schedule.meetingType ?? lead.meetingType ?? ONLINE_MEETING_TYPE
    if (resolvedMeetingType !== ONLINE_MEETING_TYPE) {
      throw new Error("Compartilhamento público disponível apenas para agendamentos online.")
    }

    const resolvedMeetingDate = schedule.date ?? lead.meetingDate
    if (!resolvedMeetingDate) {
      throw new Error("Agendamento sem data válida para compartilhamento.")
    }

    const resolvedMeetingTitle =
      schedule.meetingTitle?.trim() ||
      lead.meetingTitle?.trim() ||
      `Reunião com ${lead.name}`

    // Sempre recalcula a partir da data atual do agendamento (reagendamento invalida TTL antigo).
    const shareExpiresAt = getScheduleShareExpiry(resolvedMeetingDate)
    const shareToken = generateScheduleShareToken(schedule.id, shareExpiresAt)
    const shareTokenHash = hashScheduleShareToken(shareToken)

    await this.scheduleRepo.update(schedule.id, {
      publicShareTokenHash: shareTokenHash,
      publicShareExpiresAt: shareExpiresAt,
    })

    const closer = schedule.closerBackofficeUserId
      ? await this.userRepo.findById(schedule.closerBackofficeUserId)
      : null

    return {
      publicUrl: getFullUrl(`/backoffice-agendamento/${shareToken}`),
      expiresAt: shareExpiresAt.toISOString(),
      summary: {
        leadId: lead.id,
        leadName: lead.name,
        meetingTitle: resolvedMeetingTitle,
        meetingDate: resolvedMeetingDate.toISOString(),
        meetingType: resolvedMeetingType,
        expiresAt: shareExpiresAt.toISOString(),
        timezone: closer?.timezone ?? DEFAULT_TZ,
        isPreSchedule: false,
      },
    }
  }

  async getPublicShare(token: string): Promise<BackofficePublicScheduleShareResult> {
    const parsedToken = parseScheduleShareToken(token)
    const tokenHash = hashScheduleShareToken(token)
    const schedule = await this.scheduleRepo.findById(parsedToken.scheduleId)

    if (!schedule || schedule.isCanceled) {
      throw new Error("Link de agendamento inválido.")
    }

    if (schedule.publicShareTokenHash !== tokenHash) {
      throw new Error("Link de agendamento inválido.")
    }

    if (
      isScheduleShareExpired(schedule.publicShareExpiresAt) ||
      isScheduleShareExpired(parsedToken.expiresAt)
    ) {
      throw new Error("Link de agendamento expirado.")
    }

    const lead = await this.leadRepo.findById(schedule.leadId)
    if (!lead) {
      throw new Error("Link de agendamento inválido.")
    }

    const resolvedMeetingType = schedule.meetingType ?? lead.meetingType ?? ONLINE_MEETING_TYPE
    if (resolvedMeetingType !== ONLINE_MEETING_TYPE) {
      throw new Error("Este agendamento não está disponível para acesso público.")
    }

    const resolvedMeetingLink = schedule.meetingLink?.trim() || lead.meetingLink?.trim() || null
    const availableAt = getScheduleJoinAvailableAt(schedule.date)
    const joinAllowed = !!resolvedMeetingLink && Date.now() >= availableAt.getTime()

    const closer = schedule.closerBackofficeUserId
      ? await this.userRepo.findById(schedule.closerBackofficeUserId)
      : null

    return {
      leadName: lead.name,
      meetingTitle:
        schedule.meetingTitle?.trim() ||
        lead.meetingTitle?.trim() ||
        `Reunião com ${lead.name}`,
      meetingDate: schedule.date.toISOString(),
      meetingType: resolvedMeetingType,
      expiresAt: (schedule.publicShareExpiresAt ?? parsedToken.expiresAt).toISOString(),
      availableAt: availableAt.toISOString(),
      timezone: closer?.timezone ?? DEFAULT_TZ,
      joinAllowed,
      meetingLink: joinAllowed ? resolvedMeetingLink : null,
      isPreSchedule: false,
    }
  }
}
