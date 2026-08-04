import type { BackofficeClientInvoiceDetails } from "../context/BackofficeClientInvoiceDetailsTypes"

export interface IBackofficeClientInvoiceDetailsService {
  getById(masterId: string, invoiceId: string): Promise<BackofficeClientInvoiceDetails>
  notifyStatusEmail(masterId: string, invoiceId: string): Promise<{ message: string }>
  updateInvoice(
    masterId: string,
    invoiceId: string,
    data: { value: number; dueDate: string }
  ): Promise<BackofficeClientInvoiceDetails>
  deleteInvoice(masterId: string, invoiceId: string): Promise<{ message: string }>
}
