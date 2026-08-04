import type {
  IBackofficePaymentsService,
  BackofficePaymentItem,
  CreatePaymentFormData,
} from "./IBackofficePaymentsService"
import type { BackofficeClientItem } from "./IBackofficePaymentsService"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficePaymentsService implements IBackofficePaymentsService {
  async list(clientId?: string): Promise<BackofficePaymentItem[]> {
    const url = clientId
      ? `${API_CLIENT_BASE}/backoffice/payments?clientId=${clientId}`
      : `${API_CLIENT_BASE}/backoffice/payments`
    const res = await fetch(url, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar cobranças")
    return data.result ?? []
  }

  async create(body: CreatePaymentFormData) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async listClients(): Promise<BackofficeClientItem[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/clients`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar clientes")
    return data.result ?? []
  }
}
