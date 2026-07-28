import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { sendMessageUseCase } from "@/app/api/useCases/whatsapp/SendMessageUseCase"
import { whatsappError } from "@/lib/whatsapp/api-error"

type ForwardDestination = {
  conversationId: string
  clientMessageId: string
}

type ForwardMessageInput = {
  teamId: string
  messageId: string
  destinations: ForwardDestination[]
  access: TeamAccess
}

type ForwardDestinationResult = {
  conversationId: string
  clientMessageId: string
  messageId: string | null
  status: string | null
  ok: boolean
  error?: string
}

function mediaTypeFromMessage(
  messageType: string
): "image" | "document" | "audio" | "video" | null {
  switch (messageType) {
    case "IMAGE":
      return "image"
    case "DOCUMENT":
      return "document"
    case "AUDIO":
      return "audio"
    case "VIDEO":
      return "video"
    default:
      return null
  }
}

class ForwardMessageUseCase {
  async execute(input: ForwardMessageInput): Promise<Output> {
    try {
      if (!input.destinations.length) {
        return new Output(false, [], ["Informe ao menos um destino."], whatsappError("VALIDATION_ERROR"))
      }

      const source = await whatsAppRepository.findMessageByIdForTeam(input.teamId, input.messageId)
      if (!source || source.deletedForEveryoneAt) {
        return new Output(false, [], ["Mensagem não encontrada"], whatsappError("VALIDATION_ERROR"))
      }

      await assertCanAccessConversation(input.access, source.conversationId)

      const sourceState = await whatsAppRepository.getMessageActionsState({
        teamId: input.teamId,
        messageId: source.id,
        profileId: input.access.profileId,
      })
      if (!sourceState || sourceState.isHidden) {
        return new Output(false, [], ["Mensagem não encontrada"], whatsappError("VALIDATION_ERROR"))
      }

      const mediatype = mediaTypeFromMessage(source.messageType)
      const canForwardMedia =
        mediatype != null &&
        !!source.storagePath &&
        !!source.mediaSha256 &&
        !!source.mediaMimeType &&
        !!source.mediaFileName &&
        typeof source.mediaSizeBytes === "number" &&
        source.mediaSizeBytes > 0

      if (!canForwardMedia && !(source.contentText?.trim() || source.caption?.trim())) {
        return new Output(
          false,
          [],
          ["Não é possível encaminhar esta mensagem."],
          whatsappError("VALIDATION_ERROR")
        )
      }

      const results: ForwardDestinationResult[] = []

      for (const destination of input.destinations) {
        try {
          await assertCanAccessConversation(input.access, destination.conversationId)

          const sendOutput = await sendMessageUseCase.execute({
            teamId: input.teamId,
            conversationId: destination.conversationId,
            clientMessageId: destination.clientMessageId,
            sentByProfileId: input.access.profileId,
            access: input.access,
            contentText: canForwardMedia
              ? undefined
              : (source.contentText ?? source.caption ?? undefined),
            media: canForwardMedia
              ? {
                  mediatype: mediatype!,
                  mimeType: source.mediaMimeType!,
                  fileName: source.mediaFileName!,
                  storagePath: source.storagePath!,
                  sha256: source.mediaSha256!,
                  sizeBytes: source.mediaSizeBytes!,
                  caption: source.caption ?? undefined,
                }
              : undefined,
          })

          const sendResult = sendOutput.result as {
            messageId?: string
            status?: string
          } | null

          if (!sendOutput.isValid) {
            results.push({
              conversationId: destination.conversationId,
              clientMessageId: destination.clientMessageId,
              messageId: sendResult?.messageId ?? null,
              status: sendResult?.status ?? null,
              ok: false,
              error: sendOutput.errorMessages[0] ?? "Falha ao encaminhar",
            })
            continue
          }

          const createdMessageId = sendResult?.messageId ?? null
          if (createdMessageId) {
            await whatsAppRepository.mergeMessageRawPayload(createdMessageId, {
              forwardFromMessageId: source.id,
            })
          }

          results.push({
            conversationId: destination.conversationId,
            clientMessageId: destination.clientMessageId,
            messageId: createdMessageId,
            status: sendResult?.status ?? null,
            ok: true,
          })
        } catch (error) {
          if (error instanceof WhatsAppAccessDeniedError) {
            results.push({
              conversationId: destination.conversationId,
              clientMessageId: destination.clientMessageId,
              messageId: null,
              status: null,
              ok: false,
              error: error.message,
            })
            continue
          }
          throw error
        }
      }

      const allOk = results.every((item) => item.ok)
      await whatsAppRepository.createAuditEvent({
        teamId: input.teamId,
        conversationId: source.conversationId,
        actorProfileId: input.access.profileId,
        action: "message.forward",
        metadata: {
          messageId: source.id,
          destinations: results.map((item) => ({
            conversationId: item.conversationId,
            ok: item.ok,
          })),
        },
      })

      return new Output(
        allOk,
        allOk ? ["Mensagem encaminhada"] : [],
        allOk ? [] : ["Falha parcial ao encaminhar mensagens."],
        { sourceMessageId: source.id, results }
      )
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], whatsappError("ACCESS_DENIED"))
      }
      console.error("[ForwardMessageUseCase][execute]", error)
      return new Output(false, [], ["Não foi possível encaminhar a mensagem."], whatsappError("INTERNAL_ERROR"))
    }
  }
}

export const forwardMessageUseCase = new ForwardMessageUseCase()
