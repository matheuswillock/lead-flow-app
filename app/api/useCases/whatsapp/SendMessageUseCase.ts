import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { IWhatsAppService, SendMessageInput } from "@/app/api/services/whatsapp/IWhatsAppService"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"
import { isWithinSendRateLimit } from "@/lib/whatsapp/send-rate-limit"
import { prisma } from "@/app/api/infra/data/prisma"
import { Prisma } from "@prisma/client"

type SendMessageUseCaseInput = SendMessageInput & { access: TeamAccess; clientMessageId: string }

function isUncertainDeliveryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  return /timeout|timed out|network|fetch failed|econnreset|socket/.test(message)
}

class SendMessageUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: SendMessageUseCaseInput): Promise<Output> {
    try {
      await assertCanAccessConversation(input.access, input.conversationId)

      const existing = await prisma.$queryRaw<Array<{ conversationId: string; messageId: string | null; status: "PENDING" | "SENT" | "UNKNOWN" | "FAILED" }>>`
        select "conversationId", "messageId", status::text as status
        from whatsapp_outbound_commands where "teamId" = ${input.teamId}::uuid and "clientMessageId" = ${input.clientMessageId}
      `.then((rows) => rows[0])
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
          return new Output(false, [], ["Envio já está em processamento."], { status: existing.status })
        }
      }

      try {
        await prisma.$executeRaw`
          insert into whatsapp_outbound_commands (id, "teamId", "conversationId", "clientMessageId", status, "attemptCount", "createdAt", "updatedAt")
          values (gen_random_uuid(), ${input.teamId}::uuid, ${input.conversationId}::uuid, ${input.clientMessageId}, 'PENDING', 1, now(), now())
        `
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return new Output(false, [], ["Envio já está em processamento."], null)
        }
        throw error
      }

      const usage = await this.service.getUsageSummary(input.teamId)
      if (usage.status === "EXCEEDED") {
        return new Output(false, [], ["Limite mensal de mensagens atingido. Contate o administrador para aumentar o limite."], null)
      }

      if (!(await isWithinSendRateLimit(input.teamId))) {
        return new Output(false, [], ["Limite de envio por minuto atingido. Aguarde um momento."], null)
      }

      const result = await this.service.sendMessage(input)
      await prisma.$executeRaw`
        update whatsapp_outbound_commands set status = 'SENT', "messageId" = ${result.messageId}::uuid, "lastError" = null, "updatedAt" = now()
        where "teamId" = ${input.teamId}::uuid and "clientMessageId" = ${input.clientMessageId}
      `
      return new Output(true, ["Mensagem enviada com sucesso"], [], { ...result, status: "SENT" })
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      const status = isUncertainDeliveryError(error) ? "UNKNOWN" : "FAILED"
      await prisma.$executeRaw`
        update whatsapp_outbound_commands set status = ${status}::"WhatsAppOutboundCommandStatus", "lastError" = ${error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido"}, "updatedAt" = now()
        where "teamId" = ${input.teamId}::uuid and "clientMessageId" = ${input.clientMessageId} and status = 'PENDING'
      `.catch((commandError: unknown) => console.error("[SendMessageUseCase] Falha ao atualizar comando", commandError))
      console.error("[SendMessageUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem"
      return new Output(false, [], [message], null)
    }
  }
}

export const sendMessageUseCase = new SendMessageUseCase(whatsAppService)
