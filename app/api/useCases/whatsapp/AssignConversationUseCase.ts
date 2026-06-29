import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { isManagerLikeRole } from "@/lib/roles"

interface AssignConversationInput {
  conversationId: string
  assigneeProfileId: string
  callerIsMaster: boolean
  callerRole: string
  callerProfileId: string
}

class AssignConversationUseCase {
  async execute(input: AssignConversationInput): Promise<Output> {
    try {
      const canAssignToAnyone = input.callerIsMaster || isManagerLikeRole(input.callerRole)

      if (!canAssignToAnyone) {
        if (input.assigneeProfileId !== input.callerProfileId) {
          return new Output(false, [], ["Você só pode atribuir conversas para si mesmo"], null)
        }

        const conversation = await whatsAppRepository.findConversationById(input.conversationId)
        if (!conversation) {
          return new Output(false, [], ["Conversa não encontrada"], null)
        }
        if (
          conversation.assignedProfileId !== null &&
          conversation.assignedProfileId !== input.callerProfileId
        ) {
          return new Output(false, [], ["Esta conversa já possui um responsável"], null)
        }
      }

      const updated = await whatsAppRepository.updateConversation(input.conversationId, {
        assignedProfile: { connect: { id: input.assigneeProfileId } },
        handoffMode: "HUMAN",
      })

      return new Output(true, ["Responsável atribuído com sucesso"], [], updated)
    } catch (error) {
      console.error("[AssignConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao atribuir conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const assignConversationUseCase = new AssignConversationUseCase()
