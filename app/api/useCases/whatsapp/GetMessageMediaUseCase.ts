import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { createWhatsAppMediaSignedUrl } from "@/app/api/services/whatsapp/WhatsAppMediaStorage"
import { whatsappError } from "@/lib/whatsapp/api-error"

interface GetMessageMediaInput {
  teamId: string
  messageId: string
  access: TeamAccess
}

class GetMessageMediaUseCase {
  async execute(input: GetMessageMediaInput): Promise<Output> {
    try {
      const message = await whatsAppRepository.findMessageByIdForTeam(input.teamId, input.messageId)
      if (!message) {
        return new Output(false, [], ["Mensagem não encontrada"], whatsappError("ACCESS_DENIED"))
      }

      await assertCanAccessConversation(input.access, message.conversationId)

      if (message.mediaStatus === "PROCESSING") {
        return new Output(false, [], ["Mídia em processamento"], {
          ...whatsappError("MEDIA_PROCESSING", true),
          mediaStatus: "PROCESSING",
        })
      }
      if (message.mediaStatus === "EXPIRED") {
        return new Output(false, [], ["Mídia expirada"], {
          ...whatsappError("MEDIA_EXPIRED"),
          mediaStatus: "EXPIRED",
        })
      }
      if (message.mediaStatus === "FAILED") {
        return new Output(false, [], ["Mídia indisponível"], {
          ...whatsappError("MEDIA_UNAVAILABLE"),
          mediaStatus: "FAILED",
        })
      }

      // Defesa para linhas ainda sem backfill: storagePath implica AVAILABLE.
      if (message.storagePath) {
        const signedUrl = await createWhatsAppMediaSignedUrl(message.storagePath)
        if (signedUrl) {
          return new Output(true, [], [], {
            redirectUrl: signedUrl,
            mimeType: message.mediaMimeType,
            fileName: message.mediaFileName,
            mediaStatus: "AVAILABLE",
          })
        }
        return new Output(false, [], ["Storage temporariamente indisponível"], {
          ...whatsappError("MEDIA_UNAVAILABLE", true),
          mediaStatus: message.mediaStatus ?? "FAILED",
        })
      }

      if (message.mediaUrl || message.messageType !== "TEXT") {
        return new Output(false, [], ["Mídia em processamento"], {
          ...whatsappError("MEDIA_PROCESSING", true),
          mediaStatus: "PROCESSING",
        })
      }

      return new Output(false, [], ["Mídia indisponível para esta mensagem"], whatsappError("MEDIA_UNAVAILABLE"))
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], whatsappError("ACCESS_DENIED"))
      }
      console.error("[GetMessageMediaUseCase][execute]", { code: "INTERNAL_ERROR" })
      return new Output(false, [], ["Erro ao obter mídia"], whatsappError("INTERNAL_ERROR", true))
    }
  }
}

export const getMessageMediaUseCase = new GetMessageMediaUseCase()
