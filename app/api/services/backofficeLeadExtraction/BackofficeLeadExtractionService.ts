import { Cnpja } from "@cnpja/sdk"
import type { OfficeSearchDto } from "@cnpja/sdk"
import type { BackofficeCompanyType } from "@prisma/client"
import type { LeadExtractionFilters, LeadExtractionResultData } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadExtraction/IBackofficeLeadExtractionRepository"
import type {
  IBackofficeLeadExtractionService,
  LeadExtractionSearchOutput,
} from "./IBackofficeLeadExtractionService"

const MAX_RESULTS_PER_SEARCH = 100

// CNAEs de contabilidade/auditoria para exclusão quando removeContadores = true
const CONTADOR_CNAES = [6920601, 6920602]

function resolveCompanyType(office: {
  simei?: { optant?: boolean } | null
  company?: {
    size?: { text?: string | null } | null
    nature?: { text?: string | null } | null
  } | null
}): BackofficeCompanyType {
  if (office.simei?.optant) return "MEI"

  const size = office.company?.size?.text?.toUpperCase() ?? ""
  if (size.includes("MICRO") || size === "ME") return "ME"
  if (size.includes("PEQUENO") || size === "EPP") return "EPP"

  const nature = office.company?.nature?.text?.toUpperCase() ?? ""
  if (nature.includes("INDIVIDUAL DE RESPONSABILIDADE")) return "EIRELI"
  if (nature.includes("LIMITADA UNIPESSOAL") || nature.includes("SLU")) return "SLU"
  if (nature.includes("LIMITADA") || nature.includes("LTDA")) return "LTDA"
  if (nature.includes("ANÔNIMA") || nature.includes("ANONIMA") || nature.includes("S/A") || nature.includes("S.A")) return "SA"
  if (nature.includes("SIMPLES") && !nature.includes("OPTANTE")) return "SS"
  if (nature.includes("EMPRESÁRIO INDIVIDUAL") || nature.includes("EMPRESARIO INDIVIDUAL")) return "EI"

  return "OUTROS"
}

export class BackofficeLeadExtractionService implements IBackofficeLeadExtractionService {
  private _client: Cnpja | null = null

  private get client(): Cnpja {
    if (!this._client) {
      const apiKey = process.env.CNPJA_API_KEY
      if (!apiKey) {
        throw new Error("CNPJA_API_KEY não configurada")
      }
      this._client = new Cnpja({ apiKey })
    }
    return this._client
  }

  async search(filters: LeadExtractionFilters, limit = MAX_RESULTS_PER_SEARCH): Promise<LeadExtractionSearchOutput> {
    const query: OfficeSearchDto = {
      limit: Math.min(limit, MAX_RESULTS_PER_SEARCH),
    }

    if (filters.mainCnae) {
      query["mainActivity.id.in"] = [Number(filters.mainCnae)]
    }

    if (filters.states?.length) {
      query["address.state.in"] = filters.states as OfficeSearchDto["address.state.in"]
    }

    if (filters.municipalityCode) {
      query["address.municipality.in"] = [filters.municipalityCode]
    }

    if (filters.statusIds?.length) {
      query["status.id.in"] = filters.statusIds.map(Number)
    }

    if (filters.natureIds?.length) {
      query["company.nature.id.in"] = filters.natureIds.map(Number)
    }

    if (filters.sizeIds?.length) {
      query["company.size.id.in"] = filters.sizeIds.map(Number)
    }

    if (filters.simplesOptant !== undefined) {
      query["company.simples.optant.eq"] = filters.simplesOptant
    }

    if (filters.simeiOptant !== undefined) {
      query["company.simei.optant.eq"] = filters.simeiOptant
    }

    if (filters.foundedGte) {
      query["founded.gte"] = filters.foundedGte
    }

    if (filters.foundedLte) {
      query["founded.lte"] = filters.foundedLte
    }

    if (filters.hasPhone !== undefined) {
      query["phones.ex"] = filters.hasPhone
    }

    if (filters.hasEmail !== undefined) {
      query["emails.ex"] = filters.hasEmail
    }

    if (filters.removeContadores) {
      query["mainActivity.id.nin"] = CONTADOR_CNAES
    }

    const items: LeadExtractionResultData[] = []
    let totalCount = 0

    for await (const page of this.client.office.search(query)) {
      const offices = Array.isArray(page) ? page : [page]
      totalCount += offices.length

      for (const office of offices) {
        const phone = office.phones?.[0]
        const email = office.emails?.[0]

        items.push({
          taxId: office.taxId ?? "",
          name: office.company?.name ?? office.alias ?? "",
          tradeName: office.alias ?? null,
          email: email?.address ?? null,
          phone: phone ? `${phone.area ?? ""}${phone.number ?? ""}` : null,
          city: office.address?.city ?? null,
          state: office.address?.state ?? null,
          cnae: office.mainActivity?.id != null ? String(office.mainActivity.id) : null,
          cnaeName: office.mainActivity?.text ?? null,
          type: resolveCompanyType(office),
          raw: office as unknown as object,
        })
      }
    }

    return { items, totalCount }
  }
}
