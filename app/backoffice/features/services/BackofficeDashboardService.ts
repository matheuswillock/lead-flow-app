import type {
  IBackofficeDashboardService,
  BackofficeClientSummary,
  BackofficePaymentSummary,
} from "./IBackofficeDashboardService"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeDashboardService implements IBackofficeDashboardService {
  async fetchClients(): Promise<BackofficeClientSummary[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/clients`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar clientes")
    return data.result ?? []
  }

  async fetchPayments(): Promise<BackofficePaymentSummary[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/payments`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar pagamentos")
    return data.result ?? []
  }
}
