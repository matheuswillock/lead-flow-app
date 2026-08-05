import type { PublicOfferShare } from "../context/PublicOfferTypes"
import type { IPublicOfferService } from "./IPublicOfferService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

export class PublicOfferService implements IPublicOfferService {
  async getShare(token: string): Promise<PublicOfferShare> {
    const response = await fetch(`${API_CLIENT_BASE}/public-offers/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
    const data = (await response.json()) as OutputResponse<PublicOfferShare>

    if (!response.ok || !data.isValid || data.result === undefined) {
      throw new Error(data.errorMessages?.[0] ?? "Link de oferta indisponível")
    }

    return data.result
  }
}
