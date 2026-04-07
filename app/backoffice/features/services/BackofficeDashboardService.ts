import type {
  IBackofficeDashboardService,
  BackofficeClientSummary,
  BackofficePaymentSummary,
} from "./IBackofficeDashboardService"

export class BackofficeDashboardService implements IBackofficeDashboardService {
  async fetchClients(): Promise<BackofficeClientSummary[]> {
    const res = await fetch("/api/v1/backoffice/clients", { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar clientes")
    return data.result ?? []
  }

  async fetchPayments(): Promise<BackofficePaymentSummary[]> {
    const res = await fetch("/api/v1/backoffice/payments", { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar pagamentos")
    return data.result ?? []
  }
}
