import * as Sentry from "@sentry/nextjs"
import { whatsAppRepository } from "@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository"
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled"

const DEFAULT_THRESHOLD = 5

export function getWhatsAppWebhookFailureAlertThreshold(): number {
  const raw = process.env.WHATSAPP_WEBHOOK_FAILURE_ALERT_THRESHOLD
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_THRESHOLD
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD
}

export async function recordWhatsAppWebhookProcessingSuccess(configId: string): Promise<void> {
  await whatsAppRepository.resetWebhookConsecutiveFailures(configId)
}

export async function recordWhatsAppWebhookProcessingFailure(input: {
  configId: string
  teamId: string
  eventType: string
  errors?: string[]
  cause?: string
}): Promise<void> {
  const updated = await whatsAppRepository.incrementWebhookConsecutiveFailures(input.configId)

  const threshold = getWhatsAppWebhookFailureAlertThreshold()
  if (updated.webhookConsecutiveFailures !== threshold) {
    return
  }

  console.error(
    `[WhatsAppWebhookFailureAlert] configId=${input.configId} teamId=${input.teamId} ${threshold} falhas consecutivas no webhook`
  )

  if (!isSentryEnabled()) {
    return
  }

  Sentry.withScope((scope) => {
    scope.setLevel("error")
    scope.setFingerprint(["whatsapp-webhook-consecutive-failures", input.configId])
    scope.setTag("teamId", input.teamId)
    scope.setTag("configId", input.configId)
    scope.setTag("whatsappConnectionStatus", updated.status)
    scope.setContext("whatsapp_webhook_failure", {
      consecutiveFailures: updated.webhookConsecutiveFailures,
      threshold,
      eventType: input.eventType,
      errors: input.errors ?? [],
      cause: input.cause ?? null,
      instanceName: updated.instanceName,
      phoneNumber: updated.phoneNumber,
    })
    Sentry.captureMessage(
      `WhatsApp: ${threshold} falhas consecutivas no webhook (instância possivelmente inativa ou banida)`
    )
  })
}
