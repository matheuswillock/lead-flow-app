import { API_CLIENT_BASE } from "@/lib/route-map"
import type {
  CreatePaymentProviderInstance,
  IPaymentProviderInstancesService,
  PaymentProviderInstance,
} from "./IPaymentProviderInstancesService"

type Output<T> = { isValid: boolean; result: T | null; errorMessages?: string[] }
const URL = `${API_CLIENT_BASE}/backoffice/payment-providers/instances`

export class PaymentProviderInstancesService implements IPaymentProviderInstancesService {
  async list(): Promise<PaymentProviderInstance[]> {
    const response = await fetch(URL, { cache: "no-store" })
    const output = (await response.json()) as Output<PaymentProviderInstance[]>
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.[0] ?? "Não foi possível carregar providers")
    }
    return output.result
  }

  async create(input: CreatePaymentProviderInstance): Promise<PaymentProviderInstance> {
    const response = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const output = (await response.json()) as Output<PaymentProviderInstance>
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.[0] ?? "Não foi possível criar a instância")
    }
    return output.result
  }

  async update(input: {
    id: string
    isDefault?: boolean
    credentials?: Record<string, string>
    displayName?: string
    logoUrl?: string | null
    logoAltText?: string | null
  }): Promise<PaymentProviderInstance> {
    const response = await fetch(URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, credentials: input.credentials ?? {} }),
    })
    const output = (await response.json()) as Output<PaymentProviderInstance>
    if (!response.ok || !output.isValid || !output.result) {
      throw new Error(output.errorMessages?.[0] ?? "Não foi possível atualizar a instância")
    }
    return output.result
  }

  async checkHealth(
    provider: PaymentProviderInstance["provider"],
    environment: PaymentProviderInstance["environment"],
  ): Promise<void> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/payment-providers/config/health-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, environment }),
    })
    const output = (await response.json()) as Output<unknown>
    if (!response.ok || !output.isValid) {
      throw new Error(output.errorMessages?.[0] ?? "Não foi possível verificar o provider")
    }
  }
}

export const paymentProviderInstancesService = new PaymentProviderInstancesService()
