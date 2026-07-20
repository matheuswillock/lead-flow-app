import { Output } from "@/lib/output"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

class RequeueWhatsAppDeadLetterUseCase {
  async execute(input: { eventId: string; teamId: string; actorProfileId: string }): Promise<Output> {
    try {
      const requeued = await whatsAppRepository.requeueDeadLetterEvent(input)
      if (!requeued) return new Output(false, [], ["Evento dead-letter não encontrado"], null)
      return new Output(true, ["Evento reprocessado com sucesso"], [], { eventId: input.eventId })
    } catch (error) {
      console.error("[RequeueWhatsAppDeadLetterUseCase][execute]", error)
      return new Output(false, [], ["Não foi possível reprocessar o evento"], null)
    }
  }
}

export const requeueWhatsAppDeadLetterUseCase = new RequeueWhatsAppDeadLetterUseCase()
