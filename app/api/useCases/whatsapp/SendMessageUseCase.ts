import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { IWhatsAppService, SendMessageInput } from "@/app/api/services/whatsapp/IWhatsAppService"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppService } from "@/app/api/services/whatsapp/WhatsAppService"

type SendMessageUseCaseInput = SendMessageInput & { access: TeamAccess }

class SendMessageUseCase {
  constructor(private readonly service: IWhatsAppService) {}

  async execute(input: SendMessageUseCaseInput): Promise<Output> {
    try {
      await assertCanAccessConversation(input.access, input.conversationId)

      const result = await this.service.sendMessage(input)
      return new Output(true, ["Mensagem enviada com sucesso"], [], result)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[SendMessageUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao enviar mensagem"
      return new Output(false, [], [message], null)
    }
  }
}

export const sendMessageUseCase = new SendMessageUseCase(whatsAppService)
