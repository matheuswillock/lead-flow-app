import * as Sentry from "@sentry/nextjs"
import { backofficeCronSlackNotificationService } from "@/app/api/services/backofficeCronSlack/BackofficeCronSlackNotificationService"
import { OperationalAlerter, type SlackAlertPayload } from "@/lib/payment-provider/operational-alerts"

const ALERT_PATH = "payment-provider/alert"

/** Reaproveita o canal Slack dos crons: o alerta sai com a chave do alerta no lugar da chave do cron. */
async function sendToCronSlackChannel(payload: SlackAlertPayload): Promise<void> {
  await backofficeCronSlackNotificationService.sendFailureAlertBestEffort({
    cronKey: payload.key,
    cronPath: ALERT_PATH,
    durationMs: 0,
    error: `${payload.message}\n${JSON.stringify(payload.context)}`,
    executionId: String(payload.context.eventId ?? payload.context.chargeId ?? payload.key),
  })
}

/** Alertas operacionais de pagamento: log estruturado, Sentry e Slack. */
export const paymentProviderAlerter = new OperationalAlerter({
  sentry: Sentry,
  slack: sendToCronSlackChannel,
})
