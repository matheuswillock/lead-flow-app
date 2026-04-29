import type {
  BackofficeWebhookSource,
  BackofficeWebhookToken,
  BackofficeWebhookTokenExpiryMode,
} from "@prisma/client"

export interface RotateBackofficeWebhookTokenInput {
  source: BackofficeWebhookSource
  tokenHash: string
  tokenCipher: string
  tokenPreview: string
  expiryMode: BackofficeWebhookTokenExpiryMode
  expiresAt: Date | null
  generatedByBackofficeUserId: string
  generatedByEmailSnapshot: string
}

export interface ListBackofficeWebhookTokensParams {
  source?: BackofficeWebhookSource
  limit?: number
}

export interface IBackofficeWebhookTokenRepository {
  findActiveBySource(source: BackofficeWebhookSource): Promise<BackofficeWebhookToken | null>
  findMany(params?: ListBackofficeWebhookTokensParams): Promise<BackofficeWebhookToken[]>
  rotateActiveToken(input: RotateBackofficeWebhookTokenInput): Promise<BackofficeWebhookToken>
  markExpired(id: string): Promise<void>
  touchLastUsed(id: string): Promise<void>
}
