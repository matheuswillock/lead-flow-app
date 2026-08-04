import type {
  PublicAdhesionCheckoutInput,
  PublicAdhesionDetails,
  PublicAdhesionPayment,
} from "../context/PublicAdhesionTypes"
import type { IPublicAdhesionService } from "./IPublicAdhesionService"
import { API_CLIENT_BASE } from "@/lib/route-map";

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
      await fetch(`${API_CLIENT_BASE}/public-adhesions/${token}`, { cache: "no-store" })
    )
  }

  async createCheckout(
    token: string,
    input: PublicAdhesionCheckoutInput
  ): Promise<PublicAdhesionPayment> {
    return parseOutput<PublicAdhesionPayment>(
      await fetch(`${API_CLIENT_BASE}/public-adhesions/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
    )
  }

  async getPaymentStatus(
    token: string,
    options?: { sync?: boolean }
  ): Promise<PublicAdhesionPayment> {
    const url = `${API_CLIENT_BASE}/public-adhesions/${token}/payment-status${
      options?.sync ? "?sync=1" : ""
    }`

    return parseOutput<PublicAdhesionPayment>(
      await fetch(url, {
        cache: "no-store",
      })
    )
  }
}
