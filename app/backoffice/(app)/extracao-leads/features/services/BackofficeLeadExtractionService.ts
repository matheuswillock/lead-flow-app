import type {
  IBackofficeLeadExtractionFrontendService,
  LeadExtractionFiltersForm,
  LeadExtractionSearchResult,
} from "./IBackofficeLeadExtractionService"

export class BackofficeLeadExtractionService implements IBackofficeLeadExtractionFrontendService {
  async search(filters: LeadExtractionFiltersForm): Promise<LeadExtractionSearchResult> {
    const payload: Record<string, unknown> = {}

    if (filters.mainCnae) payload.mainCnae = filters.mainCnae
    if (filters.sideCnae && filters.mainCnae) payload.sideCnae = filters.mainCnae
    if (filters.state) payload.state = filters.state
    if (filters.municipalityCode) payload.municipalityCode = Number(filters.municipalityCode)
    if (filters.statusId) payload.statusId = filters.statusId
    if (filters.natureId) payload.natureId = filters.natureId
    if (filters.sizeId) payload.sizeId = filters.sizeId
    if (filters.simplesOptant === "true") payload.simplesOptant = true
    if (filters.simplesOptant === "false") payload.simplesOptant = false
    if (filters.simeiOptant === "true") payload.simeiOptant = true
    if (filters.simeiOptant === "false") payload.simeiOptant = false
    if (filters.foundedGte) payload.foundedGte = filters.foundedGte
    if (filters.foundedLte) payload.foundedLte = filters.foundedLte
    if (filters.hasPhone) payload.hasPhone = true
    if (filters.hasEmail) payload.hasEmail = true

    const response = await fetch("/api/v1/backoffice/extracao-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao realizar extração")
    }

    return data.result as LeadExtractionSearchResult
  }
}
