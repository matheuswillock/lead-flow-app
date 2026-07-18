import { Output } from "@/lib/output"
import { processEvoWebhookUseCase } from "./ProcessEvoWebhookUseCase"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"

class ProcessWhatsAppWebhookOutboxUseCase {
  async process(eventId: string): Promise<Output> {
    const event = await whatsAppRepository.claimWebhookEvent(eventId)
    if (!event) {
      return new Output(true, [], [], { skipped: true })
    }
    const output = await processEvoWebhookUseCase.execute({
      teamId: event.teamId,
      configId: event.configId,
      rawEvent: event.payload,
    })
    const nextStatus = output.isValid ? "PROCESSED" : event.attemptCount + 1 >= 5 ? "DEAD_LETTER" : "PENDING"
    await whatsAppRepository.completeWebhookEvent({
      eventId: event.id,
      status: nextStatus,
      error: output.isValid ? undefined : output.errorMessages.join(" "),
    })
    return output
  }

  async recover(limit = 100): Promise<Output> {
    const eventIds = await whatsAppRepository.listPendingWebhookEventIds(limit)
    const results = await Promise.all(eventIds.map((eventId) => this.process(eventId)))
    return new Output(true, ["Outbox processada"], [], { processed: results.filter((result) => result.isValid).length, total: eventIds.length })
  }
}

export const processWhatsAppWebhookOutboxUseCase = new ProcessWhatsAppWebhookOutboxUseCase()
