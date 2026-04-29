import { BackofficeLeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backofficeLead/BackofficeLeadRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backofficeLead/IBackofficeLeadRepository"
import type {
  CreateBackofficeLeadDTO,
  IBackofficeLeadUseCase,
  UpdateBackofficeLeadDTO,
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

function isValidStatus(value: unknown): value is BackofficeLeadStatus {
  return typeof value === "string" && VALID_STATUSES.has(value)
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export class BackofficeLeadUseCase implements IBackofficeLeadUseCase {
  constructor(private readonly repo: IBackofficeLeadRepository) {}

  async listLeads(params?: { status?: BackofficeLeadStatus }): Promise<Output> {
    try {
      const leads = await this.repo.findMany({ status: params?.status })
      return new Output(true, [], [], leads)
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
      return new Output(true, [], [], lead)
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

      const lead = await this.repo.create({
        name,
        email: trimOrNull(data.email),
        phone: trimOrNull(data.phone),
        notes: trimOrNull(data.notes),
        status,
        createdByProfileId,
      })

      return new Output(true, ["Lead criado com sucesso"], [], lead)
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

      const lead = await this.repo.update(id, {
        name: nextName,
        email: data.email !== undefined ? trimOrNull(data.email) : undefined,
        phone: data.phone !== undefined ? trimOrNull(data.phone) : undefined,
        notes: data.notes !== undefined ? trimOrNull(data.notes) : undefined,
      })

      return new Output(true, ["Lead atualizado com sucesso"], [], lead)
    } catch (error) {
      console.error("[BackofficeLeadUseCase][updateLead]", error)
      return new Output(false, [], ["Erro ao atualizar lead"], null)
    }
  }

  async updateLeadStatus(id: string, status: BackofficeLeadStatus): Promise<Output> {
    try {
      if (!isValidStatus(status)) {
        return new Output(false, [], ["Status inválido"], null)
      }

      const existing = await this.repo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Lead não encontrado"], null)
      }

      if (existing.status === status) {
        return new Output(true, [], [], existing)
      }

      const lead = await this.repo.updateStatus(id, status)
      return new Output(true, ["Status atualizado com sucesso"], [], lead)
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
}

export const backofficeLeadUseCase = new BackofficeLeadUseCase(
  new BackofficeLeadRepository()
)
