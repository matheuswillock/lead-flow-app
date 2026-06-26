import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface TakeoverConversationInput {
  teamId: string
  conversationId: string
  profileId: string
}

class TakeoverConversationUseCase {
  async execute(input: TakeoverConversationInput): Promise<Output> {
    try {
      const conversation = await whatsAppRepository.findConversationById(input.conversationId)
      if (!conversation || conversation.teamId !== input.teamId) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      const updated = await whatsAppRepository.updateConversation(input.conversationId, {
        handoffMode: "HUMAN",
        assignedProfile: { connect: { id: input.profileId } },
      })

      return new Output(true, ["Conversa assumida com sucesso"], [], updated)
    } catch (error) {
      console.error("[TakeoverConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao assumir conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const takeoverConversationUseCase = new TakeoverConversationUseCase()
