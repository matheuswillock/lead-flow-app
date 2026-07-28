import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import {
  assertMediaPathBelongsToTeam,
  buildClientMediaStoragePath,
  createSignedMediaUpload,
  isAllowedWhatsAppMimeType,
  normalizeMimeType,
  WHATSAPP_MEDIA_MAX_BYTES,
} from "@/app/api/services/whatsapp/WhatsAppMediaStorage"
import { whatsappError } from "@/lib/whatsapp/api-error"

export interface CreateMediaUploadInput {
  teamId: string
  access: TeamAccess
  conversationId: string
  clientMessageId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

class CreateMediaUploadUseCase {
  async execute(input: CreateMediaUploadInput): Promise<Output> {
    try {
      await assertCanAccessConversation(input.access, input.conversationId)

      const mimeType = normalizeMimeType(input.mimeType)
      if (!isAllowedWhatsAppMimeType(mimeType)) {
        return new Output(false, [], ["Tipo de mídia não suportado."], whatsappError("MEDIA_UNSUPPORTED"))
      }
      if (input.sizeBytes <= 0 || input.sizeBytes > WHATSAPP_MEDIA_MAX_BYTES) {
        return new Output(false, [], ["Arquivo excede o limite de 16MB."], whatsappError("MEDIA_TOO_LARGE"))
      }
      if (!/^[a-f0-9]{64}$/i.test(input.sha256)) {
        return new Output(false, [], ["Hash SHA-256 inválido."], whatsappError("VALIDATION_ERROR"))
      }

      const storagePath = buildClientMediaStoragePath({
        teamId: input.teamId,
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
        fileName: input.fileName,
        mimeType,
      })
      if (!assertMediaPathBelongsToTeam(storagePath, input.teamId)) {
        return new Output(false, [], ["Caminho de mídia inválido."], whatsappError("VALIDATION_ERROR"))
      }

      const signed = await createSignedMediaUpload({ storagePath })
      return new Output(true, ["Token de upload gerado"], [], {
        bucket: signed.bucket,
        storagePath,
        signedUploadToken: signed.signedUploadToken,
        expiresAt: signed.expiresAt,
        sha256: input.sha256.toLowerCase(),
        sizeBytes: input.sizeBytes,
        mimeType,
      })
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], whatsappError("ACCESS_DENIED"))
      }
      console.error("[CreateMediaUploadUseCase][execute]", {
        code: "INTERNAL_ERROR",
      })
      return new Output(false, [], ["Não foi possível preparar o upload."], whatsappError("INTERNAL_ERROR"))
    }
  }
}

export const createMediaUploadUseCase = new CreateMediaUploadUseCase()
