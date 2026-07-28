import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

class RequeueAllWhatsAppDeadLetterUseCase {
  async execute(input: { teamId: string; actorProfileId: string }): Promise<Output> {
    try {
      const requeuedCount = await whatsAppRepository.requeueAllDeadLetterEvents(input)
      if (requeuedCount === 0) {
        return new Output(false, [], ["Nenhum evento dead-letter encontrado"], null)
      }
      return new Output(
        true,
        [`${requeuedCount} evento(s) reenfileirado(s) com sucesso`],
        [],
        { requeuedCount }
      )
    } catch (error) {
      console.error("[RequeueAllWhatsAppDeadLetterUseCase][execute]", error)
      return new Output(false, [], ["Não foi possível reenfileirar os eventos dead-letter"], null)
    }
  }
}

export const requeueAllWhatsAppDeadLetterUseCase = new RequeueAllWhatsAppDeadLetterUseCase()
