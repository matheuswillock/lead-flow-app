import type { PaymentCustomer } from "@/lib/payment-provider/contracts"
import type {
  PaymentAttemptStatus,
  PaymentMethod,
  ProviderPixInstructions,
} from "@/lib/payment-provider/types"
import type { PlatformPurchaseStatus } from "@prisma/client"

export type StartPaymentInput = {
  readonly purchaseId: string
  readonly supabaseId: string
  readonly idempotencyKey: string
  readonly method: PaymentMethod
  readonly customer: PaymentCustomer
  readonly cardToken?: string
  readonly tokenIssuedAt?: string
  readonly installments?: number
}

export type StartedPayment = {
  readonly sessionId: string
  readonly attemptId: string
  readonly provider: "ASAAS" | "ABACATE_PAY"
  readonly environment: "DEV" | "PRODUCTION"
  readonly status: PaymentAttemptStatus
  readonly externalId: string | null
  readonly amountInCents: number
  readonly currency: "BRL"
  readonly method: PaymentMethod
  readonly requiresReconciliation?: true
  readonly reason?: "REMOTE_TIMEOUT" | "REMOTE_ERROR" | "MISSING_EXTERNAL_ID"
  readonly purchaseStatus: PlatformPurchaseStatus
  readonly pix?: ProviderPixInstructions
}

export interface IPaymentProviderPaymentService {
  startPayment(input: StartPaymentInput): Promise<StartedPayment>
}
