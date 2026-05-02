import { randomUUID } from "node:crypto"
import { BackofficeLeadOrigin, BackofficeLeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import {
  backofficeLeadScheduleService,
} from "@/app/api/useCases/backofficeLeadSchedule/backofficeLeadScheduleService"
import type {
  BackofficeLeadScheduleResult,
  IBackofficeLeadScheduleService,
} from "@/app/api/services/Backoffice/backofficeLeadSchedule/IBackofficeLeadScheduleService"
import type {
  BackofficeLeadUserRelation,
  BackofficeLeadWithRelations,
  IBackofficeLeadRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import type {
  CreateBackofficeLeadDTO,
  IBackofficeLeadUseCase,
  UpdateBackofficeLeadDTO,
  UpdateBackofficeLeadStatusDTO,
} from "./IBackofficeLeadUseCase"
import { IBackofficeUserRepository } from "../../infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import { BackofficeUserRepository } from "../../infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"

export const BACKOFFICE_LEAD_STATUS_VALUES = [
  "new_opportunity",
  "scheduled",
  "no_show",
  "new_adhesion",
  "lost",
  "implementation",
  "finalized",
] as const

export type BackofficeLeadStatusValue = (typeof BACKOFFICE_LEAD_STATUS_VALUES)[number]

const VALID_STATUSES = new Set<string>(BACKOFFICE_LEAD_STATUS_VALUES)
const VALID_ORIGINS = new Set<string>(Object.values(BackofficeLeadOrigin))

type ParsedDate =
  | { isValid: true; isProvided: false; value: undefined }
  | { isValid: true; isProvided: true; value: Date | null }
  | { isValid: false; errorMessage: string }

type NormalizedText =
  | { isValid: true; value: string | null }
  | { isValid: false; errorMessage: string }

type NormalizedEmails =
  | { isValid: true; value: string[] }
  | { isValid: false; errorMessage: string }

function isValidStatus(value: unknown): value is BackofficeLeadStatus {
  return typeof value === "string" && VALID_STATUSES.has(value)
}

function trimOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizePhone(value: unknown): NormalizedText {
  const raw = trimOrNull(value)
  if (!raw) return { isValid: true, value: null }

  const digits = raw.replace(/\D/g, "").slice(0, 11)
  if (!/^\d{10,11}$/.test(digits)) {
    return {
      isValid: false,
      errorMessage: "Telefone deve conter 10 ou 11 dígitos",
    }
  }

  return { isValid: true, value: digits }
}

function isValidCnpj(value: string): boolean {
  const cnpj = value.replace(/\D/g, "")
  if (cnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cnpj)) return false

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number.parseInt(digit, 10) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstDigit = calculateDigit(
    cnpj.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  )
  const secondDigit = calculateDigit(
    cnpj.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  )

  return (
    firstDigit === Number.parseInt(cnpj[12], 10) &&
    secondDigit === Number.parseInt(cnpj[13], 10)
  )
}

function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "")
  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false

  const calcDigit = (base: string, len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) {
      sum += Number.parseInt(base[i], 10) * (len + 1 - i)
    }
    const rem = (sum * 10) % 11
    return rem === 10 ? 0 : rem
  }

  return (
    calcDigit(cpf, 9) === Number.parseInt(cpf[9], 10) &&
    calcDigit(cpf, 10) === Number.parseInt(cpf[10], 10)
  )
}

function normalizeCpfCnpj(value: unknown): NormalizedText {
  const raw = trimOrNull(value)
  if (!raw) return { isValid: true, value: null }

  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 11) {
    const cpf = digits.slice(0, 11)
    if (!isValidCpf(cpf)) {
      return { isValid: false, errorMessage: "CPF inválido" }
    }
    return { isValid: true, value: cpf }
  }

  const cnpj = digits.slice(0, 14)
  if (!isValidCnpj(cnpj)) {
    return { isValid: false, errorMessage: "CNPJ inválido" }
  }
  return { isValid: true, value: cnpj }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeExtraGuests(value: unknown): NormalizedEmails {
  if (value === undefined || value === null) return { isValid: true, value: [] }
  if (!Array.isArray(value)) {
    return { isValid: false, errorMessage: "Convidados extras inválidos" }
  }

  const unique = new Set<string>()
  for (const item of value) {
    if (typeof item !== "string") {
      return { isValid: false, errorMessage: "Convidados extras inválidos" }
    }

    const email = item.trim().toLowerCase()
    if (!email) continue
    if (!isValidEmail(email)) {
      return { isValid: false, errorMessage: `E-mail de convidado inválido: ${item}` }
    }

    unique.add(email)
  }

  return { isValid: true, value: Array.from(unique) }
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((item) => setA.has(item))
}

function getScheduleResult(output: Output): BackofficeLeadScheduleResult | null {
  if (!output.result || typeof output.result !== "object") return null
  return output.result as BackofficeLeadScheduleResult
}

function parseOptionalDate(value: unknown): ParsedDate {
  if (value === undefined) {
    return { isValid: true, isProvided: false, value: undefined }
  }

  if (value === null) {
    return { isValid: true, isProvided: true, value: null }
  }

  if (typeof value !== "string") {
    return { isValid: false, errorMessage: "Data de agendamento inválida" }
  }

  const normalized = value.trim()
  if (!normalized) {
    return { isValid: true, isProvided: true, value: null }
  }

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return { isValid: false, errorMessage: "Data de agendamento inválida" }
  }

  return { isValid: true, isProvided: true, value: date }
}

function mapCompactUser(user: BackofficeLeadUserRelation | null) {
  if (!user) return null

  return {
    id: user.id,
    name: user.profile.fullName ?? user.email,
    email: user.email || user.profile.email,
  }
}

function mapLead(lead: BackofficeLeadWithRelations) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    cpfCnpj: lead.cpfCnpj,
    notes: lead.notes,
    status: lead.status,
    origin: lead.origin,
    sourceExternalId: lead.sourceExternalId,
    sourceWebhookEventId: lead.sourceWebhookEventId,
    sdrBackofficeUserId: lead.sdrBackofficeUserId,
    closerBackofficeUserId: lead.closerBackofficeUserId,
    sdr: mapCompactUser(lead.sdrBackofficeUser),
    closer: mapCompactUser(lead.closerBackofficeUser),
    meetingDate: lead.meetingDate?.toISOString() ?? null,
    meetingTitle: lead.meetingTitle,
    meetingNotes: lead.meetingNotes,
    meetingLink: lead.meetingLink,
    meetingExtraGuests: lead.meetingExtraGuests,
    adhesion: lead.adhesion
      ? {
          id: lead.adhesion.id,
          status: lead.adhesion.status,
          expiresAt: lead.adhesion.expiresAt.toISOString(),
          paidAt: lead.adhesion.paidAt?.toISOString() ?? null,
        }
      : null,
    statusEnteredAt: lead.statusEnteredAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }
}

export class BackofficeLeadUseCase implements IBackofficeLeadUseCase {
  constructor(
    private readonly repo: IBackofficeLeadRepository,
    private readonly userRepo: IBackofficeUserRepository,
    private readonly scheduleService: IBackofficeLeadScheduleService
  ) {}

  async listLeads(params?: { status?: BackofficeLeadStatus }): Promise<Output> {
    try {
      const leads = await this.repo.findMany({ status: params?.status })
      return new Output(true, [], [], leads.map(mapLead))
    } catch (error) {
      console.error("[BackofficeLeadUseCase][listLeads]", error)
      return new Output(false, [], ["Erro ao listar leads do backoffice"], null)
    }
  }

  async getLeadById(id: string): Promise<Output> {
    try {
      const lead = await this.repo.findById(id)
      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }
      return new Output(true, [], [], mapLead(lead))
    } catch (error) {
      console.error("[BackofficeLeadUseCase][getLeadById]", error)
      return new Output(false, [], ["Erro ao buscar lead"], null)
    }
  }

  async createLead(
    data: CreateBackofficeLeadDTO,
    createdByProfileId: string
  ): Promise<Output> {
    try {
      const name = trimOrNull(data.name)
      if (!name || name.length < 2) {
        return new Output(false, [], ["Nome deve ter pelo menos 2 caracteres"], null)
      }

      const status = data.status ?? BackofficeLeadStatus.new_opportunity
      if (!isValidStatus(status)) {
        return new Output(false, [], ["Status inválido"], null)
      }

      const origin = data.origin ?? BackofficeLeadOrigin.manual
      if (!VALID_ORIGINS.has(origin)) {
        return new Output(false, [], ["Origem inválida"], null)
      }

      const parsedMeetingDate = parseOptionalDate(data.meetingDate)
      if (!parsedMeetingDate.isValid) {
        return new Output(false, [], [parsedMeetingDate.errorMessage], null)
      }

      const phone = normalizePhone(data.phone)
      if (!phone.isValid) {
        return new Output(false, [], [phone.errorMessage], null)
      }

      const cnpj = normalizeCpfCnpj(data.cnpj)
      if (!cnpj.isValid) {
        return new Output(false, [], [cnpj.errorMessage], null)
      }

      const meetingExtraGuests = normalizeExtraGuests(data.meetingExtraGuests)
      if (!meetingExtraGuests.isValid) {
        return new Output(false, [], [meetingExtraGuests.errorMessage], null)
      }

      let sdrBackofficeUserId = trimOrNull(data.sdrBackofficeUserId)
      if (!sdrBackofficeUserId && origin === BackofficeLeadOrigin.manual) {
        sdrBackofficeUserId = await this.getDefaultSdrId(createdByProfileId)
      }

      if (origin === BackofficeLeadOrigin.manual && !sdrBackofficeUserId) {
        return new Output(false, [], ["SDR é obrigatório para salvar o lead"], null)
      }

      const closerBackofficeUserId = trimOrNull(data.closerBackofficeUserId)
      const normalizedMeetingLink = trimOrNull(data.meetingLink)
      const roleValidation = await this.validateAssignees({
        sdrBackofficeUserId,
        closerBackofficeUserId,
      })
      if (!roleValidation.isValid) return roleValidation

      let scheduledMeetingDate: Date | null = null
      if (status === BackofficeLeadStatus.scheduled) {
        const meetingDate = parsedMeetingDate.isProvided ? parsedMeetingDate.value : null
        if (!meetingDate) {
          return new Output(false, [], ["Data de agendamento é obrigatória"], null)
        }
        if (!closerBackofficeUserId) {
          return new Output(false, [], ["Closer é obrigatório para leads agendados"], null)
        }
        scheduledMeetingDate = meetingDate
      }

      const leadId = randomUUID()
      let lead = await this.repo.create({
        id: leadId,
        name,
        email: trimOrNull(data.email),
        phone: phone.value,
        cpfCnpj: cnpj.value,
        notes: trimOrNull(data.notes),
        status,
        origin,
        sourceExternalId: trimOrNull(data.sourceExternalId),
        sourceWebhookEventId: trimOrNull(data.sourceWebhookEventId),
        sdrBackofficeUserId,
        closerBackofficeUserId,
        meetingDate: parsedMeetingDate.isProvided ? parsedMeetingDate.value : null,
        meetingTitle: trimOrNull(data.meetingTitle),
        meetingNotes: trimOrNull(data.meetingNotes),
        meetingLink: normalizedMeetingLink,
        meetingExtraGuests: meetingExtraGuests.value,
        createdByProfileId,
      })

      if (status === BackofficeLeadStatus.scheduled) {
        const scheduleOutput = await this.scheduleService.upsertSchedule({
          leadId,
          leadName: name,
          leadEmail: trimOrNull(data.email),
          closerBackofficeUserId: closerBackofficeUserId ?? "",
          meetingDate: scheduledMeetingDate ?? new Date(),
          meetingTitle: trimOrNull(data.meetingTitle) ?? `Demonstração Corretor Studio - ${name}`,
          meetingNotes: trimOrNull(data.meetingNotes),
          meetingLink: normalizedMeetingLink,
          extraGuests: meetingExtraGuests.value,
          createdByProfileId,
        })

        if (!scheduleOutput.isValid) {
          await this.repo.delete(leadId).catch((deleteError) =>
            console.error("[BackofficeLeadUseCase][createLead][rollback]", deleteError)
          )
          return scheduleOutput
        }

        const scheduleResult = getScheduleResult(scheduleOutput)
        if (scheduleResult) {
          lead = await this.repo.update(leadId, {
            meetingTitle: scheduleResult.schedule.meetingTitle,
            meetingNotes: scheduleResult.schedule.notes,
            meetingLink: scheduleResult.meetingLink ?? null,
          })
        }
      }

      return new Output(true, ["Lead criado com sucesso"], [], mapLead(lead))
    } catch (error) {
      console.error("[BackofficeLeadUseCase][createLead]", error)
      return new Output(false, [], ["Erro ao criar lead"], null)
    }
  }

  async updateLead(id: string, data: UpdateBackofficeLeadDTO): Promise<Output> {
    try {
      const existing = await this.repo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }

      let nextName: string | undefined
      if (data.name !== undefined) {
        const name = trimOrNull(data.name)
        if (!name || name.length < 2) {
          return new Output(false, [], ["Nome deve ter pelo menos 2 caracteres"], null)
        }
        nextName = name
      }

      const parsedMeetingDate = parseOptionalDate(data.meetingDate)
      if (!parsedMeetingDate.isValid) {
        return new Output(false, [], [parsedMeetingDate.errorMessage], null)
      }

      let phoneValue: string | null | undefined
      if (data.phone !== undefined) {
        const phone = normalizePhone(data.phone)
        if (!phone.isValid) {
          return new Output(false, [], [phone.errorMessage], null)
        }
        phoneValue = phone.value
      }

      let cnpjValue: string | null | undefined
      if (data.cnpj !== undefined) {
        const cnpj = normalizeCpfCnpj(data.cnpj)
        if (!cnpj.isValid) {
          return new Output(false, [], [cnpj.errorMessage], null)
        }
        cnpjValue = cnpj.value
      }

      let meetingExtraGuestsValue: string[] | undefined
      if (data.meetingExtraGuests !== undefined) {
        const meetingExtraGuests = normalizeExtraGuests(data.meetingExtraGuests)
        if (!meetingExtraGuests.isValid) {
          return new Output(false, [], [meetingExtraGuests.errorMessage], null)
        }
        meetingExtraGuestsValue = meetingExtraGuests.value
      }

      const sdrBackofficeUserId =
        data.sdrBackofficeUserId !== undefined
          ? trimOrNull(data.sdrBackofficeUserId)
          : existing.sdrBackofficeUserId
      const closerBackofficeUserId =
        data.closerBackofficeUserId !== undefined
          ? trimOrNull(data.closerBackofficeUserId)
          : existing.closerBackofficeUserId

      if (!sdrBackofficeUserId) {
        return new Output(false, [], ["SDR é obrigatório para salvar o lead"], null)
      }

      const roleValidation = await this.validateAssignees({
        sdrBackofficeUserId:
          data.sdrBackofficeUserId !== undefined ? sdrBackofficeUserId : undefined,
        closerBackofficeUserId:
          data.closerBackofficeUserId !== undefined ? closerBackofficeUserId : undefined,
      })
      if (!roleValidation.isValid) return roleValidation

      const finalMeetingDate = parsedMeetingDate.isProvided
        ? parsedMeetingDate.value
        : existing.meetingDate
      const finalMeetingLink =
        data.meetingLink !== undefined ? trimOrNull(data.meetingLink) : existing.meetingLink
      let normalizedMeetingLinkForUpdate =
        data.meetingLink !== undefined ? trimOrNull(data.meetingLink) : undefined
      const finalMeetingTitle =
        data.meetingTitle !== undefined
          ? trimOrNull(data.meetingTitle)
          : existing.meetingTitle
      const finalMeetingNotes =
        data.meetingNotes !== undefined
          ? trimOrNull(data.meetingNotes)
          : existing.meetingNotes
      const finalMeetingExtraGuests =
        data.meetingExtraGuests !== undefined
          ? meetingExtraGuestsValue
          : existing.meetingExtraGuests

      if (existing.status === BackofficeLeadStatus.scheduled) {
        if (!finalMeetingDate) {
          return new Output(false, [], ["Data de agendamento é obrigatória"], null)
        }
        if (!closerBackofficeUserId) {
          return new Output(false, [], ["Closer é obrigatório para leads agendados"], null)
        }

        const scheduleChanged =
          (parsedMeetingDate.isProvided &&
            finalMeetingDate?.toISOString() !== existing.meetingDate?.toISOString()) ||
          (data.closerBackofficeUserId !== undefined &&
            closerBackofficeUserId !== existing.closerBackofficeUserId) ||
          (data.meetingTitle !== undefined && finalMeetingTitle !== existing.meetingTitle) ||
          (data.meetingNotes !== undefined && finalMeetingNotes !== existing.meetingNotes) ||
          (data.meetingLink !== undefined && finalMeetingLink !== existing.meetingLink) ||
          (data.meetingExtraGuests !== undefined &&
            !areStringArraysEqual(finalMeetingExtraGuests ?? [], existing.meetingExtraGuests))

        if (scheduleChanged) {
          const scheduleOutput = await this.scheduleService.upsertSchedule({
            leadId: id,
            leadName: nextName ?? existing.name,
            leadEmail: data.email !== undefined ? trimOrNull(data.email) : existing.email,
            closerBackofficeUserId,
            meetingDate: finalMeetingDate,
            meetingTitle:
              finalMeetingTitle ??
              `Demonstração Corretor Studio - ${nextName ?? existing.name}`,
            meetingNotes: finalMeetingNotes,
            meetingLink: finalMeetingLink,
            extraGuests: finalMeetingExtraGuests ?? [],
            createdByProfileId: existing.createdByProfileId,
          })
          if (!scheduleOutput.isValid) return scheduleOutput

          const scheduleResult = getScheduleResult(scheduleOutput)
          if (scheduleResult) {
            normalizedMeetingLinkForUpdate = scheduleResult.meetingLink
          }
        }
      }

      const lead = await this.repo.update(id, {
        name: nextName,
        email: data.email !== undefined ? trimOrNull(data.email) : undefined,
        phone: data.phone !== undefined ? phoneValue : undefined,
        cpfCnpj: data.cnpj !== undefined ? cnpjValue : undefined,
        notes: data.notes !== undefined ? trimOrNull(data.notes) : undefined,
        sdrBackofficeUserId:
          data.sdrBackofficeUserId !== undefined ? sdrBackofficeUserId : undefined,
        closerBackofficeUserId:
          data.closerBackofficeUserId !== undefined ? closerBackofficeUserId : undefined,
        meetingDate: parsedMeetingDate.isProvided ? parsedMeetingDate.value : undefined,
        meetingTitle:
          data.meetingTitle !== undefined ? trimOrNull(data.meetingTitle) : undefined,
        meetingNotes:
          data.meetingNotes !== undefined ? trimOrNull(data.meetingNotes) : undefined,
        meetingLink: normalizedMeetingLinkForUpdate,
        meetingExtraGuests:
          data.meetingExtraGuests !== undefined ? meetingExtraGuestsValue : undefined,
      })

      return new Output(true, ["Lead atualizado com sucesso"], [], mapLead(lead))
    } catch (error) {
      console.error("[BackofficeLeadUseCase][updateLead]", error)
      return new Output(false, [], ["Erro ao atualizar lead"], null)
    }
  }

  async updateLeadStatus(
    id: string,
    status: BackofficeLeadStatus,
    data?: UpdateBackofficeLeadStatusDTO
  ): Promise<Output> {
    try {
      if (!isValidStatus(status)) {
        return new Output(false, [], ["Status inválido"], null)
      }

      const existing = await this.repo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }

      const parsedMeetingDate = parseOptionalDate(data?.meetingDate)
      if (!parsedMeetingDate.isValid) {
        return new Output(false, [], [parsedMeetingDate.errorMessage], null)
      }

      let meetingExtraGuestsValue: string[] | undefined
      if (data?.meetingExtraGuests !== undefined) {
        const meetingExtraGuests = normalizeExtraGuests(data.meetingExtraGuests)
        if (!meetingExtraGuests.isValid) {
          return new Output(false, [], [meetingExtraGuests.errorMessage], null)
        }
        meetingExtraGuestsValue = meetingExtraGuests.value
      }

      const closerBackofficeUserId =
        data?.closerBackofficeUserId !== undefined
          ? trimOrNull(data.closerBackofficeUserId)
          : existing.closerBackofficeUserId

      if (!existing.sdrBackofficeUserId) {
        return new Output(false, [], ["SDR é obrigatório para salvar o lead"], null)
      }

      const roleValidation = await this.validateAssignees({
        closerBackofficeUserId:
          data?.closerBackofficeUserId !== undefined
            ? closerBackofficeUserId
            : undefined,
      })
      if (!roleValidation.isValid) return roleValidation

      const finalMeetingDate = parsedMeetingDate.isProvided
        ? parsedMeetingDate.value
        : existing.meetingDate
      const finalMeetingTitle =
        data?.meetingTitle !== undefined
          ? trimOrNull(data.meetingTitle)
          : existing.meetingTitle
      const finalMeetingNotes =
        data?.meetingNotes !== undefined
          ? trimOrNull(data.meetingNotes)
          : existing.meetingNotes
      const finalMeetingLink =
        data?.meetingLink !== undefined ? trimOrNull(data.meetingLink) : existing.meetingLink
      let normalizedMeetingLinkForStatus =
        data?.meetingLink !== undefined ? trimOrNull(data.meetingLink) : undefined
      const finalMeetingExtraGuests =
        data?.meetingExtraGuests !== undefined
          ? meetingExtraGuestsValue
          : existing.meetingExtraGuests

      if (status === BackofficeLeadStatus.scheduled) {
        if (!finalMeetingDate) {
          return new Output(false, [], ["Data de agendamento é obrigatória"], null)
        }
        if (!closerBackofficeUserId) {
          return new Output(false, [], ["Closer é obrigatório para leads agendados"], null)
        }

        const scheduleChanged =
          existing.status !== BackofficeLeadStatus.scheduled ||
          (parsedMeetingDate.isProvided &&
            finalMeetingDate.toISOString() !== existing.meetingDate?.toISOString()) ||
          (data?.closerBackofficeUserId !== undefined &&
            closerBackofficeUserId !== existing.closerBackofficeUserId) ||
          (data?.meetingTitle !== undefined && finalMeetingTitle !== existing.meetingTitle) ||
          (data?.meetingNotes !== undefined && finalMeetingNotes !== existing.meetingNotes) ||
          (data?.meetingLink !== undefined && finalMeetingLink !== existing.meetingLink) ||
          (data?.meetingExtraGuests !== undefined &&
            !areStringArraysEqual(finalMeetingExtraGuests ?? [], existing.meetingExtraGuests))

        if (scheduleChanged) {
          const scheduleOutput = await this.scheduleService.upsertSchedule({
            leadId: id,
            leadName: existing.name,
            leadEmail: existing.email,
            closerBackofficeUserId,
            meetingDate: finalMeetingDate,
            meetingTitle:
              finalMeetingTitle ?? `Demonstração Corretor Studio - ${existing.name}`,
            meetingNotes: finalMeetingNotes,
            meetingLink: finalMeetingLink,
            extraGuests: finalMeetingExtraGuests ?? [],
            createdByProfileId: existing.createdByProfileId,
          })
          if (!scheduleOutput.isValid) return scheduleOutput

          const scheduleResult = getScheduleResult(scheduleOutput)
          if (scheduleResult) {
            normalizedMeetingLinkForStatus = scheduleResult.meetingLink
          }
        }
      }

      const hasSchedulePayload =
        parsedMeetingDate.isProvided ||
        data?.closerBackofficeUserId !== undefined ||
        data?.meetingTitle !== undefined ||
        data?.meetingNotes !== undefined ||
        data?.meetingLink !== undefined ||
        data?.meetingExtraGuests !== undefined

      if (existing.status === status && !hasSchedulePayload) {
        return new Output(true, [], [], mapLead(existing))
      }

      const lead = await this.repo.updateStatus(id, {
        status,
        closerBackofficeUserId:
          data?.closerBackofficeUserId !== undefined
            ? closerBackofficeUserId
            : undefined,
        meetingDate: parsedMeetingDate.isProvided ? parsedMeetingDate.value : undefined,
        meetingTitle:
          data?.meetingTitle !== undefined ? trimOrNull(data.meetingTitle) : undefined,
        meetingNotes:
          data?.meetingNotes !== undefined ? trimOrNull(data.meetingNotes) : undefined,
        meetingLink: normalizedMeetingLinkForStatus,
        meetingExtraGuests:
          data?.meetingExtraGuests !== undefined ? meetingExtraGuestsValue : undefined,
      })
      return new Output(true, ["Status atualizado com sucesso"], [], mapLead(lead))
    } catch (error) {
      console.error("[BackofficeLeadUseCase][updateLeadStatus]", error)
      return new Output(false, [], ["Erro ao atualizar status"], null)
    }
  }

  async deleteLead(id: string): Promise<Output> {
    try {
      const existing = await this.repo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }

      await this.repo.delete(id)
      return new Output(true, ["Lead removido com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeLeadUseCase][deleteLead]", error)
      return new Output(false, [], ["Erro ao remover lead"], null)
    }
  }

  private async getDefaultSdrId(profileId: string): Promise<string | null> {
    const user = await this.userRepo.findByProfileId(profileId)
    if (!user?.isActive || !user.isSdr) return null
    return user.id
  }

  private async validateAssignees(input: {
    sdrBackofficeUserId?: string | null
    closerBackofficeUserId?: string | null
  }): Promise<Output> {
    if (input.sdrBackofficeUserId) {
      const sdr = await this.userRepo.findById(input.sdrBackofficeUserId)
      if (!sdr || !sdr.isActive) {
        return new Output(false, [], ["SDR informado não está ativo"], null)
      }
      if (!sdr.isSdr) {
        return new Output(false, [], ["Usuário informado não pode atuar como SDR"], null)
      }
    }

    if (input.closerBackofficeUserId) {
      const closer = await this.userRepo.findById(input.closerBackofficeUserId)
      if (!closer || !closer.isActive) {
        return new Output(false, [], ["Closer informado não está ativo"], null)
      }
      if (!closer.isCloser) {
        return new Output(false, [], ["Usuário informado não pode atuar como Closer"], null)
      }
    }

    return new Output(true, [], [], null)
  }

}

export const backofficeLeadUseCase = new BackofficeLeadUseCase(
  new BackofficeLeadRepository(),
  new BackofficeUserRepository(),
  backofficeLeadScheduleService
)
