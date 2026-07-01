import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { TeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository"
import { isManagerLikeRole } from "@/lib/roles"

const teamMembersRepository = new TeamMembersRepository()

interface AssignConversationInput {
  conversationId: string
  assigneeProfileId: string
  callerIsMaster: boolean
  callerRole: string
  callerProfileId: string
  access: TeamAccess
}

class AssignConversationUseCase {
  async execute(input: AssignConversationInput): Promise<Output> {
    try {
      await assertCanAccessConversation(input.access, input.conversationId)

      const canAssignToAnyone = input.callerIsMaster || isManagerLikeRole(input.callerRole)

      if (canAssignToAnyone && input.assigneeProfileId !== input.callerProfileId) {
        const team = await teamMembersRepository.findTeam(input.access.teamId)
        const isAssigneeMaster = team?.masterId === input.assigneeProfileId
        if (!isAssigneeMaster) {
          const membership = await teamMembersRepository.findExistingMember(
            input.access.teamId,
            input.assigneeProfileId
          )
          if (!membership) {
            return new Output(
              false,
              [],
              ["Responsável inválido para este time"],
              null
            )
          }
        }
      }

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
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[AssignConversationUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao atribuir conversa"
      return new Output(false, [], [message], null)
    }
  }
}

export const assignConversationUseCase = new AssignConversationUseCase()
