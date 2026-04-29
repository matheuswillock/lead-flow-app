import type { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { getFullUrl } from "@/lib/utils/app-url"
import {
  decryptBackofficeWebhookToken,
  isBackofficeWebhookTokenExpired,
  sanitizeBackofficeWebhookEndpointForLogs,
} from "@/lib/webhooks/backofficeWebhookSecurity"
import { BackofficeWebhookEventRepository } from "@/app/api/infra/data/repositories/backofficeWebhookEvent/BackofficeWebhookEventRepository"
import type { IBackofficeWebhookEventRepository } from "@/app/api/infra/data/repositories/backofficeWebhookEvent/IBackofficeWebhookEventRepository"
import { backofficeMetaWebhookService } from "@/app/api/services/backofficeMetaWebhook/BackofficeMetaWebhookService"
import type { IBackofficeMetaWebhookService } from "@/app/api/services/backofficeMetaWebhook/IBackofficeMetaWebhookService"
import type {
  BackofficeMetaWebhookPayload,
  GenerateBackofficeMetaWebhookTokenInput,
  IBackofficeMetaWebhookUseCase,
} from "./IBackofficeMetaWebhookUseCase"

const TOKEN_PLACEHOLDER = "{token}"

type JsonParseResult = {
  payload: unknown
  isValidJson: boolean
}

function parseWebhookRequestBody(rawBody: string): JsonParseResult {
  if (!rawBody.trim()) {
    return { payload: { rawBody }, isValidJson: false }
  }

  try {
    return { payload: JSON.parse(rawBody), isValidJson: true }
  } catch {
    return { payload: { rawBody }, isValidJson: false }
  }
}

function buildWebhookUrl(tokenSegment: string): string {
  return getFullUrl(`/api/webhooks/backoffice/meta/${tokenSegment}/lead`)
}

function getOutputStatusCode(output: Output): number {
  const result = output.result
  if (
    result &&
    typeof result === "object" &&
    "statusCode" in result &&
    typeof result.statusCode === "number"
  ) {
    return result.statusCode
  }

  return output.isValid ? 200 : 400
}

export class BackofficeMetaWebhookUseCase implements IBackofficeMetaWebhookUseCase {
  constructor(
    private readonly webhookService: IBackofficeMetaWebhookService,
    private readonly eventRepo: IBackofficeWebhookEventRepository
  ) {}

  async ingest(payload: BackofficeMetaWebhookPayload): Promise<Output> {
    const method = payload.method.trim().toUpperCase() || "POST"
    const endpoint = sanitizeBackofficeWebhookEndpointForLogs(payload.endpoint)
    const parsedBody = parseWebhookRequestBody(payload.rawBody)

    const logAndReturn = async (
      output: Output,
      resultType: "success" | "error",
      errorMessage?: string | null
    ): Promise<Output> => {
      await this.registerRequestLogSafely({
        method,
        endpoint,
        statusCode: getOutputStatusCode(output),
        resultType,
        requestPayload: parsedBody.payload,
        responsePayload: output,
        errorMessage: errorMessage ?? null,
      })
      return output
    }

    const tokenValidation = await this.webhookService.validateProvidedToken(
      payload.providedToken
    )
    if (!tokenValidation.isValid) {
      const output = new Output(false, [], [tokenValidation.errorMessage], {
        statusCode: 401,
      })
      return logAndReturn(output, "error", tokenValidation.errorMessage)
    }

    await this.webhookService.touchTokenLastUsed(tokenValidation.tokenRecord.id)

    if (!parsedBody.isValidJson || !parsedBody.payload || typeof parsedBody.payload !== "object") {
      const output = new Output(false, [], ["Payload não é JSON válido"], {
        statusCode: 400,
      })
      return logAndReturn(output, "error", "Payload não é JSON válido")
    }

    const eventType = this.extractEventType(parsedBody.payload as Record<string, unknown>)

    try {
      const event = await this.eventRepo.create({
        source: "meta",
        eventType,
        payload: parsedBody.payload as Prisma.InputJsonValue,
        signature: null,
        status: "received",
      })
      const output = new Output(true, ["Evento recebido"], [], {
        id: event.id,
        statusCode: 200,
      })
      return logAndReturn(output, "success", null)
    } catch (error) {
      console.error("[BackofficeMetaWebhookUseCase][ingest]", error)
      const output = new Output(false, [], ["Erro ao registrar evento"], {
        statusCode: 500,
      })
      return logAndReturn(output, "error", "Erro ao registrar evento")
    }
  }

  async listRecentEvents(limit?: number): Promise<Output> {
    try {
      const events = await this.eventRepo.findMany({ source: "meta", limit })
      return new Output(true, [], [], events)
    } catch (error) {
      console.error("[BackofficeMetaWebhookUseCase][listRecentEvents]", error)
      return new Output(false, [], ["Erro ao listar eventos"], null)
    }
  }

  async listTokenHistory(limit?: number): Promise<Output> {
    try {
      const tokens = await this.webhookService.listTokenHistory(limit)
      return new Output(
        true,
        [],
        [],
        tokens.map((token) => ({
          id: token.id,
          source: token.source,
          tokenPreview: token.tokenPreview,
          status: token.status,
          expiryMode: token.expiryMode,
          expiresAt: token.expiresAt?.toISOString() ?? null,
          lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
          generatedByEmailSnapshot: token.generatedByEmailSnapshot,
          generatedAt: token.generatedAt.toISOString(),
        }))
      )
    } catch (error) {
      console.error("[BackofficeMetaWebhookUseCase][listTokenHistory]", error)
      return new Output(false, [], ["Erro ao listar logs de criação do token"], null)
    }
  }

  async listRequestLogs(limit?: number): Promise<Output> {
    try {
      const logs = await this.webhookService.listRequestLogs(limit)
      return new Output(
        true,
        [],
        [],
        logs.map((log) => ({
          id: log.id,
          source: log.source,
          method: log.method,
          endpoint: log.endpoint,
          statusCode: log.statusCode,
          resultType: log.resultType,
          requestPayload: log.requestPayload,
          responsePayload: log.responsePayload,
          errorMessage: log.errorMessage,
          createdAt: log.createdAt.toISOString(),
        }))
      )
    } catch (error) {
      console.error("[BackofficeMetaWebhookUseCase][listRequestLogs]", error)
      return new Output(false, [], ["Erro ao listar logs do webhook"], null)
    }
  }

  async getIntegrationConfig(): Promise<Output> {
    const activeToken = await this.webhookService.getActiveToken()
    const decryptedToken = activeToken
      ? decryptBackofficeWebhookToken(activeToken.tokenCipher)
      : null
    const isExpired = activeToken
      ? isBackofficeWebhookTokenExpired(activeToken.expiresAt)
      : false
    const tokenSegment = decryptedToken ?? TOKEN_PLACEHOLDER

    return new Output(true, [], [], {
      provider: "meta" as const,
      configured: Boolean(activeToken),
      webhookUrl: buildWebhookUrl(tokenSegment),
      webhookUrlTemplate: buildWebhookUrl(TOKEN_PLACEHOLDER),
      tokenPreview: activeToken?.tokenPreview ?? null,
      tokenStatus: !activeToken ? "missing" : isExpired ? "expired" : activeToken.status,
      expiryMode: activeToken?.expiryMode ?? "indeterminate",
      expiresAt: activeToken?.expiresAt?.toISOString() ?? null,
      isExpired,
      lastUsedAt: activeToken?.lastUsedAt?.toISOString() ?? null,
      generatedByEmailSnapshot: activeToken?.generatedByEmailSnapshot ?? null,
      generatedAt: activeToken?.generatedAt?.toISOString() ?? null,
    })
  }

  async generateToken(input: GenerateBackofficeMetaWebhookTokenInput): Promise<Output> {
    try {
      const result = await this.webhookService.rotateToken({
        expiryMode: input.expiryMode,
        generatedByBackofficeUserId: input.generatedByBackofficeUserId,
        generatedByEmailSnapshot: input.generatedByEmailSnapshot,
      })

      if (!result) {
        return new Output(false, [], ["Não foi possível proteger o token do webhook"], null)
      }

      return new Output(true, ["Token do webhook gerado com sucesso"], [], {
        provider: "meta" as const,
        configured: true,
        webhookUrl: buildWebhookUrl(result.token),
        webhookUrlTemplate: buildWebhookUrl(TOKEN_PLACEHOLDER),
        token: result.token,
        tokenPreview: result.record.tokenPreview,
        tokenStatus: result.record.status,
        expiryMode: result.record.expiryMode,
        expiresAt: result.record.expiresAt?.toISOString() ?? null,
        isExpired: false,
        lastUsedAt: result.record.lastUsedAt?.toISOString() ?? null,
        generatedByEmailSnapshot: result.record.generatedByEmailSnapshot,
        generatedAt: result.record.generatedAt.toISOString(),
      })
    } catch (error) {
      console.error("[BackofficeMetaWebhookUseCase][generateToken]", error)
      return new Output(false, [], ["Erro ao gerar token do webhook"], null)
    }
  }

  private async registerRequestLogSafely(input: {
    method: string
    endpoint: string
    statusCode: number
    resultType: "success" | "error"
    requestPayload: unknown
    responsePayload: unknown
    errorMessage?: string | null
  }): Promise<void> {
    try {
      await this.webhookService.registerRequestLog(input)
    } catch (error) {
      console.error("[BackofficeMetaWebhookUseCase][registerRequestLog]", error)
    }
  }

  private extractEventType(payload: Record<string, unknown>): string | null {
    const object = payload.object
    const entry = Array.isArray(payload.entry) ? payload.entry[0] : null
    const changes =
      entry && typeof entry === "object" && Array.isArray((entry as Record<string, unknown>).changes)
        ? ((entry as Record<string, unknown>).changes as unknown[])[0]
        : null
    const field =
      changes && typeof changes === "object"
        ? (changes as Record<string, unknown>).field
        : null

    if (typeof object === "string" && typeof field === "string") {
      return `${object}.${field}`
    }
    if (typeof object === "string") return object
    if (typeof field === "string") return field
    return null
  }
}

export const backofficeMetaWebhookUseCase = new BackofficeMetaWebhookUseCase(
  backofficeMetaWebhookService,
  new BackofficeWebhookEventRepository()
)
