import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { processEvoWebhookUseCase } from "./ProcessEvoWebhookUseCase"
import { Prisma } from "@prisma/client"

type OutboxEvent = { id: string; teamId: string; configId: string; payload: Prisma.JsonValue; status: string; attemptCount: number }

class ProcessWhatsAppWebhookOutboxUseCase {
  async process(eventId: string): Promise<Output> {
    const event = await prisma.$queryRaw<OutboxEvent[]>`
      select id, "teamId", "configId", payload, status::text as status, "attemptCount"
      from whatsapp_webhook_events where id = ${eventId}::uuid
    `.then((rows) => rows[0])
    if (!event || event.status === "PROCESSED" || event.status === "DEAD_LETTER") {
      return new Output(true, [], [], { skipped: true })
    }

    await prisma.$executeRaw`
      update whatsapp_webhook_events set status = 'PROCESSING', "attemptCount" = "attemptCount" + 1, "updatedAt" = now() where id = ${event.id}::uuid
    `
    const output = await processEvoWebhookUseCase.execute({
      teamId: event.teamId,
      configId: event.configId,
      rawEvent: event.payload,
    })
    const nextStatus = output.isValid ? "PROCESSED" : event.attemptCount + 1 >= 5 ? "DEAD_LETTER" : "PENDING"
    await prisma.$executeRaw`
      update whatsapp_webhook_events
      set status = ${nextStatus}::"WhatsAppWebhookEventStatus", "processedAt" = ${output.isValid ? new Date() : null}, "lastError" = ${output.isValid ? null : output.errorMessages.join(" ").slice(0, 500)}, "updatedAt" = now()
      where id = ${event.id}::uuid
    `
    return output
  }

  async recover(limit = 100): Promise<Output> {
    const events = await prisma.$queryRaw<Array<{ id: string }>>`
      select id from whatsapp_webhook_events where status = 'PENDING' order by "createdAt" asc limit ${Math.min(limit, 100)}
    `
    const results = await Promise.all(events.map((event) => this.process(event.id)))
    return new Output(true, ["Outbox processada"], [], { processed: results.filter((result) => result.isValid).length, total: events.length })
  }
}

export const processWhatsAppWebhookOutboxUseCase = new ProcessWhatsAppWebhookOutboxUseCase()
