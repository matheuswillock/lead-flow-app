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
}
