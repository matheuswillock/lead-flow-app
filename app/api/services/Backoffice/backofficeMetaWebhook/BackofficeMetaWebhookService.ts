import type {
  BackofficeWebhookRequestLog,
  BackofficeWebhookToken,
} from "@prisma/client"
import { BackofficeWebhookRequestLogRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeWebhookRequestLog/BackofficeWebhookRequestLogRepository"
import type { IBackofficeWebhookRequestLogRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeWebhookRequestLog/IBackofficeWebhookRequestLogRepository"
import { BackofficeWebhookTokenRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeWebhookToken/BackofficeWebhookTokenRepository"
import type { IBackofficeWebhookTokenRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeWebhookToken/IBackofficeWebhookTokenRepository"
import {
  buildBackofficeWebhookTokenPreview,
  computeBackofficeWebhookTokenExpiry,
  encryptBackofficeWebhookToken,
  generateBackofficeWebhookToken,
  hashBackofficeWebhookToken,
  isBackofficeWebhookTokenExpired,
  safeBackofficeWebhookTokenEquals,
} from "@/lib/webhooks/backofficeWebhookSecurity"
import type {
  BackofficeMetaWebhookTokenValidationResult,
  IBackofficeMetaWebhookService,
  RegisterBackofficeMetaWebhookRequestLogInput,
  RotateBackofficeMetaWebhookTokenInput,
  RotateBackofficeMetaWebhookTokenResult,
} from "./IBackofficeMetaWebhookService"

const BACKOFFICE_META_WEBHOOK_SOURCE = "meta" as const

export class BackofficeMetaWebhookService implements IBackofficeMetaWebhookService {
  constructor(
    private readonly tokenRepo: IBackofficeWebhookTokenRepository,
    private readonly requestLogRepo: IBackofficeWebhookRequestLogRepository
  ) {}

  async getActiveToken(): Promise<BackofficeWebhookToken | null> {
    return this.tokenRepo.findActiveBySource(BACKOFFICE_META_WEBHOOK_SOURCE)
  }

  async rotateToken(
    input: RotateBackofficeMetaWebhookTokenInput
  ): Promise<RotateBackofficeMetaWebhookTokenResult | null> {
    const token = generateBackofficeWebhookToken()
    const tokenCipher = encryptBackofficeWebhookToken(token)
    if (!tokenCipher) return null

    const record = await this.tokenRepo.rotateActiveToken({
      source: BACKOFFICE_META_WEBHOOK_SOURCE,
      tokenHash: hashBackofficeWebhookToken(token),
      tokenCipher,
      tokenPreview: buildBackofficeWebhookTokenPreview(token),
      expiryMode: input.expiryMode,
      expiresAt: computeBackofficeWebhookTokenExpiry(input.expiryMode),
      generatedByBackofficeUserId: input.generatedByBackofficeUserId,
      generatedByEmailSnapshot: input.generatedByEmailSnapshot,
    })

    return { token, record }
  }

  async validateProvidedToken(
    providedToken: string | null | undefined
  ): Promise<BackofficeMetaWebhookTokenValidationResult> {
    const activeToken = await this.getActiveToken()
    if (!activeToken) {
      return { isValid: false, errorMessage: "Token ativo não configurado" }
    }

    if (isBackofficeWebhookTokenExpired(activeToken.expiresAt)) {
      await this.tokenRepo.markExpired(activeToken.id)
      return { isValid: false, errorMessage: "Token expirado" }
    }

    if (typeof providedToken !== "string" || providedToken.trim().length === 0) {
      return { isValid: false, errorMessage: "Token inválido" }
    }

    const isValid = safeBackofficeWebhookTokenEquals(
      providedToken.trim(),
      activeToken.tokenHash
    )
    if (!isValid) {
      return { isValid: false, errorMessage: "Token inválido" }
    }

    return { isValid: true, tokenRecord: activeToken }
  }

  async touchTokenLastUsed(id: string): Promise<void> {
    await this.tokenRepo.touchLastUsed(id)
  }

  async listTokenHistory(limit?: number): Promise<BackofficeWebhookToken[]> {
    return this.tokenRepo.findMany({
      source: BACKOFFICE_META_WEBHOOK_SOURCE,
      limit,
    })
  }

  async listRequestLogs(limit?: number): Promise<BackofficeWebhookRequestLog[]> {
    return this.requestLogRepo.findMany({
      source: BACKOFFICE_META_WEBHOOK_SOURCE,
      limit,
    })
  }

  async registerRequestLog(
    input: RegisterBackofficeMetaWebhookRequestLogInput
  ): Promise<void> {
    await this.requestLogRepo.create({
      source: BACKOFFICE_META_WEBHOOK_SOURCE,
      method: input.method,
      endpoint: input.endpoint,
      statusCode: input.statusCode,
      resultType: input.resultType,
      requestPayload: input.requestPayload,
      responsePayload: input.responsePayload,
      errorMessage: input.errorMessage,
    })
  }
}

export const backofficeMetaWebhookService = new BackofficeMetaWebhookService(
  new BackofficeWebhookTokenRepository(),
  new BackofficeWebhookRequestLogRepository()
)
