import { Output } from "@/lib/output"
import { processEvoWebhookUseCase } from "./ProcessEvoWebhookUseCase"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { getWhatsAppWebhookRetryAt, WHATSAPP_WEBHOOK_MAX_ATTEMPTS } from "./whatsappWebhookRetry"
import { emitWhatsAppSloMetric } from "@/lib/whatsapp/slo-metrics"

const OUTBOX_CONCURRENCY = 2

class ProcessWhatsAppWebhookOutboxUseCase {
  async process(eventId: string): Promise<Output> {
    const startedAt = Date.now()
    const event = await whatsAppRepository.claimWebhookEvent(eventId)
    if (!event) {
      return new Output(true, [], [], { skipped: true })
    }
    const output = await processEvoWebhookUseCase.execute({
      teamId: event.teamId,
      configId: event.configId,
      rawEvent: event.payload,
    })
    const nextStatus = output.isValid
      ? "PROCESSED"
      : event.attemptCount >= WHATSAPP_WEBHOOK_MAX_ATTEMPTS
        ? "DEAD_LETTER"
        : "PENDING"
    const nextAttemptAt = nextStatus === "PENDING"
      ? getWhatsAppWebhookRetryAt(event.attemptCount)
      : null
    await whatsAppRepository.completeWebhookEvent({
      eventId: event.id,
      expectedAttemptCount: event.attemptCount,
      status: nextStatus,
      error: output.isValid ? undefined : output.errorMessages.join(" "),
      nextAttemptAt,
    })

    emitWhatsAppSloMetric("whatsapp_webhook_to_ui_ms", {
      result: output.isValid ? "ok" : "error",
      ms: Date.now() - startedAt,
      status: nextStatus,
    })
    if (nextStatus === "DEAD_LETTER") {
      emitWhatsAppSloMetric("whatsapp_outbox_failure", {
        status: "DEAD_LETTER",
      })
    }

    return output
  }

  async recover(limit = 100): Promise<Output> {
    const eventIds = await whatsAppRepository.listPendingWebhookEventIds(limit)
    const results: Output[] = []
    for (let start = 0; start < eventIds.length; start += OUTBOX_CONCURRENCY) {
      const batch = eventIds.slice(start, start + OUTBOX_CONCURRENCY)
      results.push(...await Promise.all(batch.map((eventId) => this.process(eventId))))
    }
    const reconciledOutbound = await whatsAppRepository.reconcileStaleOutboundCommands()
    return new Output(true, ["Outbox processada"], [], {
      processed: results.filter((result) => result.isValid).length,
      total: eventIds.length,
      reconciledOutbound,
    })
  }
}

export const processWhatsAppWebhookOutboxUseCase = new ProcessWhatsAppWebhookOutboxUseCase()
