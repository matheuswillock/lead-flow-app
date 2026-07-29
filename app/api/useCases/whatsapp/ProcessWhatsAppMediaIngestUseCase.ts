import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { evolutionWhatsAppProvider } from "@/app/api/services/whatsapp/provider/EvolutionWhatsAppProvider"
import type { IWhatsAppProvider } from "@/app/api/services/whatsapp/provider/IWhatsAppProvider"
import { uploadWhatsAppMediaBuffer, fetchRemoteMediaBuffer } from "@/app/api/services/whatsapp/WhatsAppMediaStorage"
import { emitWhatsAppSloMetric } from "@/lib/whatsapp/slo-metrics"

const MAX_ATTEMPTS = 5

function extractMessageKey(rawPayload: unknown): Record<string, unknown> | null {
  if (typeof rawPayload !== "object" || rawPayload === null) return null
  const record = rawPayload as Record<string, unknown>
  const key = record["key"]
  if (typeof key === "object" && key !== null) {
    return key as Record<string, unknown>
  }
  return null
}

function isExpiredOriginError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return /404|410|expired|expir|not found|gone|invalid media/.test(message)
}

class ProcessWhatsAppMediaIngestUseCase {
  constructor(private readonly provider: IWhatsAppProvider = evolutionWhatsAppProvider) {}

  async execute(limit = 20): Promise<Output> {
    const claimed = await whatsAppRepository.claimMediaIngestBatch(limit)
    let available = 0
    let expired = 0
    let failed = 0
    let deferred = 0

    for (const message of claimed) {
      try {
        const config = await whatsAppRepository.findConfigByTeamId(message.teamId)
        if (!config) {
          await whatsAppRepository.markMediaIngestResult({
            messageId: message.id,
            status: message.mediaAttemptCount >= MAX_ATTEMPTS ? "FAILED" : "PROCESSING",
            errorCode: "CONFIG_NOT_FOUND",
          })
          if (message.mediaAttemptCount >= MAX_ATTEMPTS) failed += 1
          else deferred += 1
          continue
        }
        const effectiveConfig = await whatsAppRepository.resolveEffectiveConfig(config)
        const messageKey = extractMessageKey(message.rawPayload)

        let base64: string | null = null
        let mimeType = message.mediaMimeType ?? "application/octet-stream"

        if (messageKey) {
          const media = await this.provider.resolveMediaBase64({
            instanceName: effectiveConfig.instanceName,
            messageKey,
          })
          if (media?.base64) {
            base64 = media.base64
            if (media.mimeType) mimeType = media.mimeType
          }
        }

        if (!base64 && message.mediaUrl?.startsWith("http")) {
          const remote = await fetchRemoteMediaBuffer(message.mediaUrl)
          base64 = remote.buffer.toString("base64")
          if (remote.mimeType) mimeType = remote.mimeType
        }

        if (!base64) {
          throw new Error("MEDIA_UNAVAILABLE")
        }

        const stored = await uploadWhatsAppMediaBuffer({
          teamId: message.teamId,
          conversationId: message.conversationId,
          objectId: message.id,
          buffer: Buffer.from(base64, "base64"),
          mimeType,
          fileName: message.mediaFileName ?? undefined,
        })

        await whatsAppRepository.markMediaIngestResult({
          messageId: message.id,
          status: "AVAILABLE",
          storagePath: stored.storagePath,
          mediaSha256: stored.mediaSha256,
          mediaSizeBytes: stored.mediaSizeBytes,
          errorCode: null,
          mediaRetrievedAt: new Date(),
        })
        available += 1
      } catch (error) {
        const expiredOrigin = isExpiredOriginError(error) || (error instanceof Error && error.message === "MEDIA_EXPIRED")
        if (expiredOrigin) {
          await whatsAppRepository.markMediaIngestResult({
            messageId: message.id,
            status: "EXPIRED",
            errorCode: "MEDIA_EXPIRED",
          })
          expired += 1
          continue
        }

        const exhausted = message.mediaAttemptCount >= MAX_ATTEMPTS
        await whatsAppRepository.markMediaIngestResult({
          messageId: message.id,
          status: exhausted ? "FAILED" : "PROCESSING",
          errorCode: "MEDIA_UNAVAILABLE",
        })
        if (exhausted) {
          failed += 1
          emitWhatsAppSloMetric("whatsapp_media_ingest_failure", {
            status: "FAILED",
          })
        } else deferred += 1
        console.error("[ProcessWhatsAppMediaIngestUseCase]", {
          code: "MEDIA_INGEST_ATTEMPT_FAILED",
          attempt: message.mediaAttemptCount,
        })
      }
    }

    return new Output(true, ["Ingestão de mídia processada"], [], {
      claimed: claimed.length,
      available,
      expired,
      failed,
      deferred,
    })
  }
}

export const processWhatsAppMediaIngestUseCase = new ProcessWhatsAppMediaIngestUseCase()
