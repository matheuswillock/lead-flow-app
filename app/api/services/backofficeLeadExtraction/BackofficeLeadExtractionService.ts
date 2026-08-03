import { Cnpja } from "@cnpja/sdk"
import type { LeadExtractionFilters, LeadExtractionResultData } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadExtraction/IBackofficeLeadExtractionRepository"
import type {
  IBackofficeLeadExtractionService,
  LeadExtractionSearchOutput,
} from "./IBackofficeLeadExtractionService"

const MAX_RESULTS_PER_SEARCH = 100

export class BackofficeLeadExtractionService implements IBackofficeLeadExtractionService {
  private readonly client: Cnpja

  constructor() {
    const apiKey = process.env.CNPJA_API_KEY
    if (!apiKey) {
      throw new Error("CNPJA_API_KEY não configurada")
    }
    this.client = new Cnpja({ apiKey })
  }

  async search(filters: LeadExtractionFilters, limit = MAX_RESULTS_PER_SEARCH): Promise<LeadExtractionSearchOutput> {
    const query: Record<string, unknown> = {
      limit: Math.min(limit, MAX_RESULTS_PER_SEARCH),
    }

    if (filters.mainCnae) {
      query["mainActivity.id.in"] = [Number(filters.mainCnae)]
    }

    if (filters.sideCnae) {
      query["sideActivity.id.in"] = [Number(filters.sideCnae)]
    }

    if (filters.state) {
      query["address.state.in"] = [filters.state]
    }

    if (filters.municipalityCode) {
      query["address.municipality.in"] = [filters.municipalityCode]
    }

    if (filters.statusId) {
      query["status.id.in"] = [Number(filters.statusId)]
    }

    if (filters.natureId) {
      query["nature.id.in"] = [Number(filters.natureId)]
    }

    if (filters.sizeId) {
      query["size.id.in"] = [Number(filters.sizeId)]
    }

    if (filters.simplesOptant !== undefined) {
      query["simples.optant"] = filters.simplesOptant
    }

    if (filters.simeiOptant !== undefined) {
      query["simei.optant"] = filters.simeiOptant
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

    const items: LeadExtractionResultData[] = []
    let totalCount = 0

    for await (const page of this.client.office.search(query as Parameters<typeof this.client.office.search>[0])) {
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
          type: office.company?.nature?.text ?? null,
          raw: office as unknown as object,
        })
      }
    }

    return { items, totalCount }
  }
}
