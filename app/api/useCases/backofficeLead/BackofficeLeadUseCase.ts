import { BackofficeLeadOrigin, BackofficeLeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficeUserRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficeUserRepository"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backofficeLead/BackofficeLeadRepository"
import type {
  BackofficeLeadUserRelation,
  BackofficeLeadWithRelations,
  IBackofficeLeadRepository,
} from "@/app/api/infra/data/repositories/backofficeLead/IBackofficeLeadRepository"
import type {
  CreateBackofficeLeadDTO,
  IBackofficeLeadUseCase,
  UpdateBackofficeLeadDTO,
  UpdateBackofficeLeadStatusDTO,
} from "./IBackofficeLeadUseCase"

export const BACKOFFICE_LEAD_STATUS_VALUES = [
  "new_opportunity",
  "scheduled",
  "no_show",
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

function isValidStatus(value: unknown): value is BackofficeLeadStatus {
  return typeof value === "string" && VALID_STATUSES.has(value)
}

function trimOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
    statusEnteredAt: lead.statusEnteredAt.toISOString(),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }
}

export class BackofficeLeadUseCase implements IBackofficeLeadUseCase {
  constructor(
    private readonly repo: IBackofficeLeadRepository,
    private readonly userRepo: IBackofficeUserRepository
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

      let sdrBackofficeUserId = trimOrNull(data.sdrBackofficeUserId)
      if (!sdrBackofficeUserId && origin === BackofficeLeadOrigin.manual) {
        sdrBackofficeUserId = await this.getDefaultSdrId(createdByProfileId)
      }

      if (origin === BackofficeLeadOrigin.manual && !sdrBackofficeUserId) {
        return new Output(false, [], ["SDR é obrigatório para salvar o lead"], null)
      }

      const closerBackofficeUserId = trimOrNull(data.closerBackofficeUserId)
      const roleValidation = await this.validateAssignees({
        sdrBackofficeUserId,
        closerBackofficeUserId,
      })
      if (!roleValidation.isValid) return roleValidation

      if (status === BackofficeLeadStatus.scheduled) {
        const meetingDate = parsedMeetingDate.isProvided ? parsedMeetingDate.value : null
        if (!meetingDate) {
          return new Output(false, [], ["Data de agendamento é obrigatória"], null)
        }
        if (!closerBackofficeUserId) {
          return new Output(false, [], ["Closer é obrigatório para leads agendados"], null)
        }
      }

      const lead = await this.repo.create({
        name,
        email: trimOrNull(data.email),
        phone: trimOrNull(data.phone),
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
        meetingLink: trimOrNull(data.meetingLink),
        createdByProfileId,
      })

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

      if (existing.status === BackofficeLeadStatus.scheduled) {
        if (!finalMeetingDate) {
          return new Output(false, [], ["Data de agendamento é obrigatória"], null)
        }
        if (!closerBackofficeUserId) {
          return new Output(false, [], ["Closer é obrigatório para leads agendados"], null)
        }
      }

      const lead = await this.repo.update(id, {
        name: nextName,
        email: data.email !== undefined ? trimOrNull(data.email) : undefined,
        phone: data.phone !== undefined ? trimOrNull(data.phone) : undefined,
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
        meetingLink:
          data.meetingLink !== undefined ? trimOrNull(data.meetingLink) : undefined,
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

      if (status === BackofficeLeadStatus.scheduled) {
        if (!finalMeetingDate) {
          return new Output(false, [], ["Data de agendamento é obrigatória"], null)
        }
        if (!closerBackofficeUserId) {
          return new Output(false, [], ["Closer é obrigatório para leads agendados"], null)
        }
      }

      const hasSchedulePayload =
        parsedMeetingDate.isProvided ||
        data?.closerBackofficeUserId !== undefined ||
        data?.meetingTitle !== undefined ||
        data?.meetingNotes !== undefined ||
        data?.meetingLink !== undefined

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
        meetingLink:
          data?.meetingLink !== undefined ? trimOrNull(data.meetingLink) : undefined,
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
  new BackofficeUserRepository()
)
