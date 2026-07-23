import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { IWhatsAppService, SendMessageInput } from "@/app/api/services/whatsapp/IWhatsAppService"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { consumeSendRateLimit } from "@/lib/whatsapp/send-rate-limit"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

type SendMessageUseCaseInput = SendMessageInput & { access: TeamAccess; clientMessageId: string }

function isUncertainDeliveryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  return /provider_accepted_persistence_failed|provider_timeout|timeout|timed out|network|fetch failed|econnreset|socket/.test(message)
}

function messageTypeFor(input: SendMessageUseCaseInput): "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" {
  if (!input.media) return "TEXT"
  return input.media.mediatype === "image" ? "IMAGE"
    : input.media.mediatype === "document" ? "DOCUMENT"
      : input.media.mediatype === "audio" ? "AUDIO" : "VIDEO"
}

class SendMessageUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: SendMessageUseCaseInput): Promise<Output> {
    try {
      await assertCanAccessConversation(input.access, input.conversationId)

      const existing = await whatsAppRepository.findOutboundCommand(input.teamId, input.clientMessageId)
      if (existing) {
        if (existing.conversationId !== input.conversationId) {
          return new Output(false, [], ["clientMessageId já pertence a outra conversa"], null)
        }
        if (existing.status === "SENT" && existing.messageId) {
          return new Output(true, ["Mensagem já enviada"], [], { messageId: existing.messageId, status: existing.status })
        }
        if (existing.status === "UNKNOWN") {
          return new Output(false, [], ["Envio pendente de confirmação. Não tente reenviar automaticamente."], { messageId: existing.messageId, status: existing.status })
        }
        if (existing.status === "PENDING") {
          return new Output(false, [], ["Envio já está em processamento."], { messageId: existing.messageId, status: existing.status })
        }
      }

      const durable = await whatsAppRepository.createPendingOutboundMessageAndCommand({
        teamId: input.teamId,
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
        sentByProfileId: input.sentByProfileId,
        contentText: input.contentText,
        messageType: messageTypeFor(input),
        mediaMimeType: input.media?.mimeType,
        mediaFileName: input.media?.fileName,
        caption: input.media?.caption,
      })
      if (!durable.created || !durable.messageId) {
        return new Output(false, [], ["Envio já está em processamento."], { messageId: durable.messageId, status: "PENDING" })
      }

      const usage = await this.service.getUsageSummary(input.teamId)
      if (usage.status === "EXCEEDED") {
        return new Output(false, [], ["Limite mensal de mensagens atingido. Contate o administrador para aumentar o limite."], null)
      }

      if (!(await consumeSendRateLimit(input.teamId))) {
        return new Output(false, [], ["Limite de envio por minuto atingido. Aguarde um momento."], null)
      }

      const result = await this.service.sendMessage({
        ...input,
        pendingMessageId: durable.messageId,
        clientMessageId: input.clientMessageId,
      })
      await whatsAppRepository.completeOutboundCommand({
        teamId: input.teamId,
        clientMessageId: input.clientMessageId,
        messageId: result.messageId,
      })
      return new Output(true, ["Mensagem enviada com sucesso"], [], { ...result, status: "SENT" })
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      const status = isUncertainDeliveryError(error) ? "UNKNOWN" : "FAILED"
      await whatsAppRepository.failOutboundCommand({
        teamId: input.teamId,
        clientMessageId: input.clientMessageId,
        status,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }).catch((commandError: unknown) => console.error("[SendMessageUseCase] Falha ao atualizar comando", commandError))
      const durable = await whatsAppRepository.findOutboundCommand(input.teamId, input.clientMessageId)
      if (durable?.messageId) {
        await whatsAppRepository.updateMessageStatus(durable.messageId, {
          status,
          ...(status === "FAILED" ? { failedAt: new Date() } : {}),
        }).catch(() => undefined)
      }
      console.error("[SendMessageUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem"
      return new Output(false, [], [message], null)
    }
  }
}

export const sendMessageUseCase = new SendMessageUseCase(whatsAppService)
