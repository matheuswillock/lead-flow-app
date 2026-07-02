import type { PublicContractShare } from "../context/PublicContractTypes"
import type { IPublicContractService } from "./IPublicContractService"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

export class PublicContractService implements IPublicContractService {
  async getShare(token: string): Promise<PublicContractShare> {
    const response = await fetch(`/api/v1/public-contracts/${token}`, { cache: "no-store" })
    const data = (await response.json()) as OutputResponse<PublicContractShare>

    if (!response.ok || !data.isValid || data.result === undefined) {
      throw new Error(data.errorMessages?.[0] ?? "Link de contrato indisponível")
    }

    return data.result
  }
}
