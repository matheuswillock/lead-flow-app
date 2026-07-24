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
import { createHash } from "node:crypto"
import { whatsappError } from "@/lib/whatsapp/api-error"

type SendMessageUseCaseInput = SendMessageInput & { access: TeamAccess; clientMessageId: string; retryFailed?: boolean }

function requestHash(input: SendMessageUseCaseInput): string {
  return createHash("sha256")
    .update(JSON.stringify({
      conversationId: input.conversationId,
      contentText: input.contentText ?? null,
      mentionedJids: input.mentionedJids ?? [],
      media: input.media
        ? { mediatype: input.media.mediatype, mimeType: input.media.mimeType, fileName: input.media.fileName, caption: input.media.caption ?? null, base64: input.media.base64 }
        : null,
    }))
    .digest("hex")
}

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
      const intentHash = requestHash(input)

      let claimedRetry = false
      const existing = await whatsAppRepository.findOutboundCommand(input.teamId, input.clientMessageId)
      if (existing) {
        if (existing.conversationId !== input.conversationId) {
          return new Output(false, [], ["A intenção de envio não corresponde à conversa."], whatsappError("IDEMPOTENCY_CONFLICT"))
        }
        if (existing.requestHash && existing.requestHash !== intentHash) {
          return new Output(false, [], ["A intenção de envio não corresponde ao conteúdo original."], whatsappError("IDEMPOTENCY_CONFLICT"))
        }
        if (existing.status === "SENT" && existing.messageId) {
          return new Output(true, ["Mensagem já enviada"], [], { messageId: existing.messageId, status: existing.status, idempotentReplay: true })
        }
        if (existing.status === "UNKNOWN") {
          return new Output(true, ["Envio aguardando confirmação. Não reenvie automaticamente."], [], { messageId: existing.messageId, status: existing.status, deliveryCertainty: "UNKNOWN" })
        }
        if (existing.status === "PENDING") {
          return new Output(true, ["Envio já está em processamento."], [], { messageId: existing.messageId, status: existing.status })
        }
        if (existing.status === "FAILED") {
          if (!input.retryFailed) {
            return new Output(false, [], ["O envio falhou. Confirme para tentar novamente."], whatsappError("PROVIDER_OFFLINE", true))
          }
          const retry = await whatsAppRepository.retryFailedOutboundCommand({
            teamId: input.teamId,
            clientMessageId: input.clientMessageId,
            requestHash: intentHash,
          })
          if (!retry.claimed || !retry.messageId) {
            return new Output(false, [], ["Não foi possível reutilizar a intenção de envio."], whatsappError("IDEMPOTENCY_CONFLICT"))
          }
          claimedRetry = true
        }
      }

      const usage = await this.service.getUsageSummary(input.teamId)
      if (usage.status === "EXCEEDED") {
        return new Output(false, [], ["Limite mensal de mensagens atingido. Contate o administrador para aumentar o limite."], whatsappError("QUOTA_EXCEEDED"))
      }
      if (!(await consumeSendRateLimit(input.teamId))) {
        return new Output(false, [], ["Limite de envio por minuto atingido. Aguarde um momento."], whatsappError("RATE_LIMITED", true))
      }

      const durable = await whatsAppRepository.createPendingOutboundMessageAndCommand({
        teamId: input.teamId,
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
        requestHash: intentHash,
        sentByProfileId: input.sentByProfileId,
        contentText: input.contentText,
        messageType: messageTypeFor(input),
        mediaMimeType: input.media?.mimeType,
        mediaFileName: input.media?.fileName,
        caption: input.media?.caption,
      })
      if (!durable.messageId) {
        return new Output(false, [], ["Não foi possível registrar a intenção de envio."], whatsappError("INTERNAL_ERROR"))
      }
      // A unique command is the claim to call Evolution. If a concurrent
      // request won the transaction, returning its durable state prevents a
      // second delivery for the same clientMessageId. A claimed retry already
      // owns the PENDING command, so createPending returns created:false and
      // must continue to the provider call.
      if (!durable.created && !claimedRetry) {
        if (durable.conversationId !== input.conversationId) {
          return new Output(false, [], ["A intenção de envio não corresponde à conversa."], whatsappError("IDEMPOTENCY_CONFLICT"))
        }
        if (durable.requestHash && durable.requestHash !== intentHash) {
          return new Output(false, [], ["A intenção de envio não corresponde ao conteúdo original."], whatsappError("IDEMPOTENCY_CONFLICT"))
        }
        return new Output(true, ["Envio já está em processamento."], [], {
          messageId: durable.messageId,
          status: "PENDING",
          idempotentReplay: true,
        })
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
      return new Output(true, ["Mensagem enviada com sucesso"], [], { ...result, status: "SENT", deliveryCertainty: "CONFIRMED", idempotentReplay: false })
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
      console.error("[SendMessageUseCase][execute] falha no envio", {
        status,
        correlationId: whatsappError(status === "UNKNOWN" ? "DELIVERY_UNKNOWN" : "PROVIDER_OFFLINE").correlationId,
      })
      if (status === "UNKNOWN") {
        return new Output(true, ["Envio aguardando confirmação."], [], { messageId: durable?.messageId ?? null, status, deliveryCertainty: "UNKNOWN" })
      }
      return new Output(false, [], ["Não foi possível enviar a mensagem."], whatsappError("PROVIDER_OFFLINE", true))
    }
  }
}

export const sendMessageUseCase = new SendMessageUseCase(whatsAppService)
