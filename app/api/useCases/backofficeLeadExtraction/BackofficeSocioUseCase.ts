import { Output } from "@/lib/output"
import { BackofficeLeadExtractionService } from "@/app/api/services/backofficeLeadExtraction/BackofficeLeadExtractionService"
import type { IBackofficeLeadExtractionService, PersonSearchFilters } from "@/app/api/services/backofficeLeadExtraction/IBackofficeLeadExtractionService"

export type { PersonSearchFilters }

export class BackofficeSocioUseCase {
  constructor(private readonly service: IBackofficeLeadExtractionService) {}

  async search(filters: PersonSearchFilters, limit?: number): Promise<Output> {
    try {
      const { items, totalCount } = await this.service.searchPersons(filters, limit)
      return new Output(true, [], [], { items, totalCount })
    } catch (error) {
      console.error("[BackofficeSocioUseCase][search]", error)
      const msg = error instanceof Error ? error.message : ""
      const userMessage = msg.toLowerCase().includes("not enough credits")
        ? "Créditos insuficientes na conta CNPJá. Recarregue os créditos e tente novamente."
        : msg.toLowerCase().includes("rate limit")
        ? "Limite de requisições CNPJá atingido. Aguarde alguns minutos e tente novamente."
        : "Erro ao pesquisar sócios"
      return new Output(false, [], [userMessage], null)
    }
  }
}

export const backofficeSocioUseCase = new BackofficeSocioUseCase(new BackofficeLeadExtractionService())
