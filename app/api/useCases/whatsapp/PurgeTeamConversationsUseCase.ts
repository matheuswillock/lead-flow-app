import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

class PurgeTeamConversationsUseCase {
  async execute(input: { teamId: string; actorProfileId: string }): Promise<Output> {
    try {
      const deletedCount = await whatsAppRepository.softDeleteAllTeamConversationsWithAudit(input)
      return new Output(
        true,
        [
          deletedCount === 0
            ? "Nenhuma conversa ativa para remover"
            : `${deletedCount} conversa(s) removida(s) com sucesso`,
        ],
        [],
        { deletedCount }
      )
    } catch (error) {
      console.error("[PurgeTeamConversationsUseCase][execute]", error)
      return new Output(false, [], ["Não foi possível zerar as conversas do time"], null)
    }
  }
}

export const purgeTeamConversationsUseCase = new PurgeTeamConversationsUseCase()
