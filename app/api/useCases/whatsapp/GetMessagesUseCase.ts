import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface GetMessagesInput {
  conversationId: string
  teamId: string
  page?: number
  limit?: number
}

class GetMessagesUseCase {
  async execute(input: GetMessagesInput): Promise<Output> {
    try {
      const result = await whatsAppRepository.listMessages({
        conversationId: input.conversationId,
        page: input.page,
        limit: input.limit,
      })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[GetMessagesUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao buscar mensagens"
      return new Output(false, [], [message], null)
    }
  }
}

export const getMessagesUseCase = new GetMessagesUseCase()
