import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { evoApiService } from "@/app/api/services/whatsapp/evo/EvoApiService"

interface GetMessageMediaInput {
  teamId: string
  messageId: string
}

function extractMessageKey(rawPayload: unknown): Record<string, unknown> | null {
  if (typeof rawPayload !== "object" || rawPayload === null) return null
  const record = rawPayload as Record<string, unknown>
  const key = record["key"]
  if (typeof key === "object" && key !== null) {
    return key as Record<string, unknown>
  }
  return null
}

function extractOutboundMedia(
  rawPayload: unknown
): { base64: string; mimeType?: string } | null {
  if (typeof rawPayload !== "object" || rawPayload === null) return null
  const record = rawPayload as Record<string, unknown>
  const outbound = record["outboundMedia"]
  if (typeof outbound !== "object" || outbound === null) return null
  const media = outbound as Record<string, unknown>
  if (typeof media.base64 !== "string" || !media.base64) return null
  return {
    base64: media.base64,
    mimeType: typeof media.mimeType === "string" ? media.mimeType : undefined,
  }
}

class GetMessageMediaUseCase {
  async execute(input: GetMessageMediaInput): Promise<Output> {
    try {
      const message = await whatsAppRepository.findMessageByIdForTeam(input.teamId, input.messageId)
      if (!message) {
        return new Output(false, [], ["Mensagem não encontrada"], null)
      }

      const outboundMedia = extractOutboundMedia(message.rawPayload)
      if (outboundMedia) {
        return new Output(true, [], [], {
          base64: outboundMedia.base64,
          mimeType: outboundMedia.mimeType || message.mediaMimeType,
          fileName: message.mediaFileName,
        })
      }

      const config = await whatsAppRepository.findConfigByTeamId(input.teamId)
      if (!config) {
        return new Output(false, [], ["Configuração WhatsApp não encontrada"], null)
      }

      const messageKey = extractMessageKey(message.rawPayload)
      if (!messageKey && message.providerMessageId) {
        const conversation = await whatsAppRepository.findConversationById(message.conversationId)
        if (conversation?.externalChatId) {
          return new Output(true, [], [], {
            base64: null,
            mimeType: message.mediaMimeType,
            fileName: message.mediaFileName,
            fallbackUrl: message.mediaUrl,
            providerMessageId: message.providerMessageId,
            externalChatId: conversation.externalChatId,
            direction: message.direction,
          })
        }
      }

      if (!messageKey) {
        if (message.mediaUrl?.startsWith("http")) {
          return new Output(true, [], [], {
            redirectUrl: message.mediaUrl,
            mimeType: message.mediaMimeType,
            fileName: message.mediaFileName,
          })
        }
        return new Output(false, [], ["Mídia indisponível para esta mensagem"], null)
      }

      const media = await evoApiService.getBase64FromMediaMessage({
        instanceName: config.instanceName,
        messageKey,
        hostBaseUrl: config.hostBaseUrl ?? undefined,
      })

      if (!media) {
        return new Output(false, [], ["Não foi possível baixar a mídia"], null)
      }

      return new Output(true, [], [], {
        base64: media.base64,
        mimeType: media.mimeType || message.mediaMimeType,
        fileName: message.mediaFileName,
      })
    } catch (error) {
      console.error("[GetMessageMediaUseCase][execute]", error)
      const msg = error instanceof Error ? error.message : "Erro ao obter mídia"
      return new Output(false, [], [msg], null)
    }
  }
}

export const getMessageMediaUseCase = new GetMessageMediaUseCase()
