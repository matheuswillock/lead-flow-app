import type { IBackofficeClientInvoiceDetailsService } from "./IBackofficeClientInvoiceDetailsService"
import type { BackofficeClientInvoiceDetails } from "../context/BackofficeClientInvoiceDetailsTypes"

export class BackofficeClientInvoiceDetailsService
  implements IBackofficeClientInvoiceDetailsService
{
  async getById(masterId: string, invoiceId: string): Promise<BackofficeClientInvoiceDetails> {
    const response = await fetch(
      `/api/v1/backoffice/platform-users/${masterId}/invoices/${invoiceId}`,
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
      `/api/v1/backoffice/platform-users/${masterId}/invoices/${invoiceId}`,
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
}
