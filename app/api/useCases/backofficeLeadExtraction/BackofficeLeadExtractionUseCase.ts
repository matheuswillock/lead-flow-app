import { Output } from "@/lib/output"
import { BackofficeLeadExtractionRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadExtraction/BackofficeLeadExtractionRepository"
import type { IBackofficeLeadExtractionRepository, LeadExtractionFilters } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadExtraction/IBackofficeLeadExtractionRepository"
import { BackofficeLeadExtractionService } from "@/app/api/services/backofficeLeadExtraction/BackofficeLeadExtractionService"
import type { IBackofficeLeadExtractionService } from "@/app/api/services/backofficeLeadExtraction/IBackofficeLeadExtractionService"
import {
  BACKOFFICE_LEAD_EXTRACTION_STATUS_ATIVA,
  clampLeadExtractionLimit,
} from "@/lib/backoffice/lead-extraction-constants"

export type { LeadExtractionFilters }

function normalizeIsoDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  return value
}

export class BackofficeLeadExtractionUseCase {
  constructor(
    private readonly repo: IBackofficeLeadExtractionRepository,
    private readonly service: IBackofficeLeadExtractionService
  ) {}

  async search(profileId: string, filters: LeadExtractionFilters, limit?: number): Promise<Output> {
    let extractionId: string | null = null
    try {
      const safeLimit = clampLeadExtractionLimit(limit ?? filters.limit)
      const normalizedFilters: LeadExtractionFilters = {
        ...filters,
        statusIds: [BACKOFFICE_LEAD_EXTRACTION_STATUS_ATIVA],
        foundedGte: normalizeIsoDate(filters.foundedGte),
        foundedLte: normalizeIsoDate(filters.foundedLte),
        limit: safeLimit,
      }

      const extraction = await this.repo.create(profileId, normalizedFilters)
      extractionId = extraction.id

      await this.repo.updateStatus(extraction.id, "RUNNING")

      const { items, totalCount } = await this.service.search(normalizedFilters, safeLimit)

      await this.repo.saveResults(extraction.id, items)
      await this.repo.updateStatus(extraction.id, "DONE", totalCount)

      return new Output(true, [], [], {
        extractionId: extraction.id,
        totalCount,
        items,
      })
    } catch (error) {
      console.error("[BackofficeLeadExtractionUseCase][search]", error)
      if (extractionId) {
        await this.repo.updateStatus(extractionId, "ERROR").catch(() => null)
      }
      const msg = error instanceof Error ? error.message : ""
      const userMessage = msg.toLowerCase().includes("not enough credits")
        ? "Créditos insuficientes na conta CNPJá. Recarregue os créditos e tente novamente."
        : msg.toLowerCase().includes("rate limit")
        ? "Limite de requisições CNPJá atingido. Aguarde alguns minutos e tente novamente."
        : "Erro ao realizar extração de leads"
      return new Output(false, [], [userMessage], null)
    }
  }

  async getResults(id: string, page: number, pageSize: number): Promise<Output> {
    try {
      const safePage = Math.max(1, page)
      const safePageSize = Math.min(100, Math.max(10, pageSize))

      const extraction = await this.repo.findWithResults(id, safePage, safePageSize)
      if (!extraction) {
        return new Output(false, [], ["Extração não encontrada"], null)
      }

      const totalPages = Math.max(1, Math.ceil(extraction.totalCount / safePageSize))
      return new Output(true, [], [], {
        extractionId: extraction.id,
        status: extraction.status,
        totalCount: extraction.totalCount,
        filters: extraction.filters,
        createdAt: extraction.createdAt,
        items: extraction.results,
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPreviousPage: safePage > 1,
        },
      })
    } catch (error) {
      console.error("[BackofficeLeadExtractionUseCase][getResults]", error)
      return new Output(false, [], ["Erro ao buscar resultados da extração"], null)
    }
  }

  async listHistory(profileId: string, page: number, pageSize: number): Promise<Output> {
    try {
      const safePage = Math.max(1, page)
      const safePageSize = Math.min(50, Math.max(5, pageSize))

      const { items, total } = await this.repo.listByProfile(profileId, safePage, safePageSize)
      const totalPages = Math.max(1, Math.ceil(total / safePageSize))

      return new Output(true, [], [], {
        items,
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          totalItems: total,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPreviousPage: safePage > 1,
        },
      })
    } catch (error) {
      console.error("[BackofficeLeadExtractionUseCase][listHistory]", error)
      return new Output(false, [], ["Erro ao listar histórico de extrações"], null)
    }
  }
}

const repository = new BackofficeLeadExtractionRepository()
const cnpjaService = new BackofficeLeadExtractionService()

export const backofficeLeadExtractionUseCase = new BackofficeLeadExtractionUseCase(
  repository,
  cnpjaService
)
