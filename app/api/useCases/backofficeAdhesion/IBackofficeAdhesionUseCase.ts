import type { BackofficeAdhesionStatus } from "@prisma/client"
import type { Output } from "@/lib/output"
import type {
  BackofficeAdhesionCheckoutInput,
  BackofficeAdhesionCreateInput,
  BackofficeAdhesionPaymentWebhookInput,
  BackofficeAdhesionUpdateInput,
} from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"

export interface IBackofficeAdhesionUseCase {
  list(input: {
    page: number
    pageSize: number
    status?: BackofficeAdhesionStatus
    query?: string
  }): Promise<Output>
  getOptions(): Promise<Output>
  create(input: BackofficeAdhesionCreateInput, createdByBackofficeUserId: string | null): Promise<Output>
  update(id: string, input: BackofficeAdhesionUpdateInput): Promise<Output>
  deletePending(id: string): Promise<Output>
  resend(id: string): Promise<Output>
  resendInvite(id: string): Promise<Output>
  getPublicUrl(id: string): Promise<Output>
  getPublicDetails(token: string): Promise<Output>
  createCheckout(token: string, input: BackofficeAdhesionCheckoutInput): Promise<Output>
  getPaymentStatus(token: string, options?: { sync?: boolean }): Promise<Output>
  processPaymentWebhook(
    event: string,
    payment: BackofficeAdhesionPaymentWebhookInput
  ): Promise<Output>
}
