import type { IBackofficeClientInvoiceDetailsService } from "./IBackofficeClientInvoiceDetailsService"
import type { BackofficeClientInvoiceDetails } from "../context/BackofficeClientInvoiceDetailsTypes"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeClientInvoiceDetailsService
  implements IBackofficeClientInvoiceDetailsService
{
  async getById(masterId: string, invoiceId: string): Promise<BackofficeClientInvoiceDetails> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/invoices/${invoiceId}`,
      {
        cache: "no-store",
      }
    )

    const data = await response.json()

    if (!data.isValid || !data.result) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao carregar detalhes da fatura")
    }

    return data.result
  }

  async notifyStatusEmail(masterId: string, invoiceId: string): Promise<{ message: string }> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/invoices/${invoiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "notify-status-email" }),
      }
    )

    const data = await response.json()

    if (!data.isValid) {
      throw new Error(data.errorMessages?.[0] ?? "Erro ao enviar notificação")
    }

    return {
      message: data.successMessages?.[0] ?? "Notificação enviada com sucesso",
    }
  }

  async updateInvoice(
    masterId: string,
    invoiceId: string,
    data: { value: number; dueDate: string }
  ): Promise<BackofficeClientInvoiceDetails> {
    const response = await fetch(
      `${API_CLIENT_BASE}/backoffice/platform-users/${masterId}/invoices/${invoiceId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    )

    const json = await response.json()

    if (!json.isValid || !json.result) {
      throw new Error(json.errorMessages?.[0] ?? "Erro ao atualizar a cobrança")
    }

    return json.result
  }
}
