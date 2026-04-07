import type { BackofficeClientInvoiceDetails } from "../context/BackofficeClientInvoiceDetailsTypes"

export interface IBackofficeClientInvoiceDetailsService {
  getById(masterId: string, invoiceId: string): Promise<BackofficeClientInvoiceDetails>
}
