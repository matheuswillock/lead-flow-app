import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  assertCanAccessConversation,
  WhatsAppAccessDeniedError,
} from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

interface SetConversationHandoffInput {
  teamId: string
  conversationId: string
  mode: "BOT" | "HUMAN"
  access: TeamAccess
}

class SetConversationHandoffUseCase {
  async execute(input: SetConversationHandoffInput): Promise<Output> {
    try {
      const conversation = await assertCanAccessConversation(input.access, input.conversationId)
      if (conversation.teamId !== input.teamId) {
        return new Output(false, [], ["Conversa não encontrada"], null)
      }

      const updated = await whatsAppRepository.updateConversation(input.conversationId, {
        handoffMode: input.mode,
      })

      await whatsAppRepository.createAuditEvent({
        teamId: input.teamId,
        conversationId: input.conversationId,
        actorProfileId: input.access.profileId,
        action: "conversation.handoff",
        metadata: { mode: input.mode },
      })

      const message =
        input.mode === "BOT"
          ? "Conversa devolvida ao bot com sucesso"
          : "Conversa assumida para atendimento humano"

      return new Output(true, [message], [], updated)
    } catch (error) {
      if (error instanceof WhatsAppAccessDeniedError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[SetConversationHandoffUseCase][execute]", error)
      const message = error instanceof Error ? error.message : "Erro ao alterar modo de handoff"
      return new Output(false, [], [message], null)
    }
  }
}

export const setConversationHandoffUseCase = new SetConversationHandoffUseCase()
