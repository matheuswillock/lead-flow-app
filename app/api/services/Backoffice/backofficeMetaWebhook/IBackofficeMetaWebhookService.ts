import type {
  BackofficeWebhookRequestLog,
  BackofficeWebhookToken,
} from "@prisma/client"
import type {
  BackofficeWebhookRequestLogResultType,
  CreateBackofficeWebhookRequestLogInput,
} from "@/app/api/infra/data/repositories/backoffice/backofficeWebhookRequestLog/IBackofficeWebhookRequestLogRepository"
import type { BackofficeWebhookTokenExpiryModeValue } from "@/lib/webhooks/backofficeWebhookSecurity"

export type RotateBackofficeMetaWebhookTokenInput = {
  expiryMode: BackofficeWebhookTokenExpiryModeValue
  generatedByBackofficeUserId: string
  generatedByEmailSnapshot: string
}

export type RotateBackofficeMetaWebhookTokenResult = {
  token: string
  record: BackofficeWebhookToken
}

export type BackofficeMetaWebhookTokenValidationResult =
  | { isValid: true; tokenRecord: BackofficeWebhookToken }
  | { isValid: false; errorMessage: string }

export type RegisterBackofficeMetaWebhookRequestLogInput =
  Omit<CreateBackofficeWebhookRequestLogInput, "source" | "resultType"> & {
    resultType: BackofficeWebhookRequestLogResultType
  }

export interface IBackofficeMetaWebhookService {
  getActiveToken(): Promise<BackofficeWebhookToken | null>
  rotateToken(
    input: RotateBackofficeMetaWebhookTokenInput
  ): Promise<RotateBackofficeMetaWebhookTokenResult | null>
  validateProvidedToken(
    providedToken: string | null | undefined
  ): Promise<BackofficeMetaWebhookTokenValidationResult>
  touchTokenLastUsed(id: string): Promise<void>
  listTokenHistory(limit?: number): Promise<BackofficeWebhookToken[]>
  listRequestLogs(limit?: number): Promise<BackofficeWebhookRequestLog[]>
  registerRequestLog(input: RegisterBackofficeMetaWebhookRequestLogInput): Promise<void>
}
