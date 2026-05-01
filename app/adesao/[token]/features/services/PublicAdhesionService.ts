import type {
  PublicAdhesionCheckoutInput,
  PublicAdhesionDetails,
  PublicAdhesionPayment,
} from "../context/PublicAdhesionTypes"
import type { IPublicAdhesionService } from "./IPublicAdhesionService"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? "Não foi possível carregar a adesão")
  }
  return data.result
}

export class PublicAdhesionService implements IPublicAdhesionService {
  async getDetails(token: string): Promise<PublicAdhesionDetails> {
    return parseOutput<PublicAdhesionDetails>(
      await fetch(`/api/v1/public-adhesions/${token}`, { cache: "no-store" })
    )
  }

  async createCheckout(
    token: string,
    input: PublicAdhesionCheckoutInput
  ): Promise<PublicAdhesionPayment> {
    return parseOutput<PublicAdhesionPayment>(
      await fetch(`/api/v1/public-adhesions/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    )
  }

  async getPaymentStatus(token: string): Promise<PublicAdhesionPayment> {
    return parseOutput<PublicAdhesionPayment>(
      await fetch(`/api/v1/public-adhesions/${token}/payment-status`, {
        cache: "no-store",
      })
    )
  }
}
