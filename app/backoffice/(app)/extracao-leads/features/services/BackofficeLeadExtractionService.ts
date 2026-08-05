import type {
  IBackofficeLeadExtractionFrontendService,
  LeadExtractionFiltersForm,
  LeadExtractionSearchResult,
  CnaeOption,
  SocioFiltersForm,
  SocioSearchResult,
} from "./IBackofficeLeadExtractionService"

export class BackofficeLeadExtractionService implements IBackofficeLeadExtractionFrontendService {
  async searchCnaes(q?: string): Promise<CnaeOption[]> {
    const url = q
      ? `/api/v1/backoffice/cnaes?q=${encodeURIComponent(q)}`
      : "/api/v1/backoffice/cnaes"
    const res = await fetch(url)
    if (!res.ok) throw new Error("Erro ao buscar CNAEs")
    const data = (await res.json()) as { items: CnaeOption[] }
    return data.items
  }

  async search(filters: LeadExtractionFiltersForm): Promise<LeadExtractionSearchResult> {
    const payload: Record<string, unknown> = {}

    if (filters.mainCnae) payload.mainCnae = filters.mainCnae
    if (filters.states.length > 0) payload.states = filters.states
    if (filters.municipalityCode) payload.municipalityCode = Number(filters.municipalityCode)
    if (filters.statusIds.length > 0) payload.statusIds = filters.statusIds
    if (filters.natureIds.length > 0) payload.natureIds = filters.natureIds
    if (filters.sizeIds.length > 0) payload.sizeIds = filters.sizeIds
    if (filters.simplesOptant === "true") payload.simplesOptant = true
    if (filters.simplesOptant === "false") payload.simplesOptant = false
    if (filters.simeiOptant === "true") payload.simeiOptant = true
    if (filters.simeiOptant === "false") payload.simeiOptant = false
    if (filters.foundedGte) payload.foundedGte = filters.foundedGte
    if (filters.foundedLte) payload.foundedLte = filters.foundedLte
    if (filters.hasPhone) payload.hasPhone = true
    if (filters.hasEmail) payload.hasEmail = true
    payload.removeContadores = filters.removeContadores

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

  async searchSocios(filters: SocioFiltersForm): Promise<SocioSearchResult> {
    const names = filters.names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)

    const payload: Record<string, unknown> = {}
    if (names.length > 0) payload.names = names
    if (filters.types.length > 0) payload.types = filters.types
    if (filters.ageRanges.length > 0) payload.ageRanges = filters.ageRanges

    const response = await fetch("/api/v1/backoffice/socios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao pesquisar sócios")
    }

    return data.result as SocioSearchResult
  }
}
