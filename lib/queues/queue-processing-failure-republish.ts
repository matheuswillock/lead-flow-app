import type { Prisma } from "@prisma/client"
import { publishWithRetry } from "@/lib/queues/publish-with-retry"
import {
  publishPublicFormMetricEvent,
  PUBLIC_FORM_METRIC_EVENTS_TOPIC,
  type PublicFormMetricQueuePayload,
} from "@/lib/queues/public-form-metric-events"
import { publishPublicFormSubmissionEvent, PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC } from "@/lib/queues/public-form-submission-events"
import {
  publishPublicFormProgressEvent,
  PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
  type PublicFormProgressQueuePayload,
} from "@/lib/queues/public-form-progress-events"
import {
  publishRadarEngagementScoreUpdate,
  RADAR_ENGAGEMENT_SCORE_UPDATES_TOPIC,
  type RadarEngagementScoreUpdatePayload,
} from "@/lib/queues/radar-engagement-score-updates"
import {
  publishResendWebhookRadarEvent,
  RESEND_WEBHOOK_RADAR_EVENTS_TOPIC,
  type ResendWebhookRadarEventPayload,
} from "@/lib/queues/resend-webhook-radar-events"
import {
  publishRadarEmailContactSyncWake,
  RADAR_EMAIL_CONTACT_SYNC_TOPIC,
  type RadarEmailContactSyncWakePayload,
} from "@/lib/queues/radar-email-contact-sync"
import {
  publishRadarProfileSync,
  RADAR_PROFILE_SYNC_TOPIC,
  type RadarProfileSyncPayload,
} from "@/lib/queues/radar-profile-sync"
import {
  publishRadarPixelEvent,
  RADAR_PIXEL_EVENTS_TOPIC,
  type RadarPixelEventPayload,
} from "@/lib/queues/radar-pixel-events"
import {
  publishRadarBulkImportBatch,
  RADAR_BULK_IMPORT_TOPIC,
  type RadarBulkImportPayload,
} from "@/lib/queues/radar-bulk-import"
import {
  publishWhatsappRadarEvent,
  WHATSAPP_RADAR_EVENTS_TOPIC,
  type WhatsappRadarEventPayload,
} from "@/lib/queues/whatsapp-radar-events"
import {
  publishEmailCampaignDispatchWake,
  EMAIL_CAMPAIGN_DISPATCH_TOPIC,
  type EmailCampaignDispatchWakePayload,
} from "@/lib/queues/email-campaign-dispatch"
import {
  publishResendWebhookEmailLogEvent,
  RESEND_WEBHOOK_EMAILLOG_EVENTS_TOPIC,
  type ResendWebhookEmailLogEventPayload,
} from "@/lib/queues/resend-webhook-emaillog-events"
import { ASAAS_WEBHOOK_EVENTS_TOPIC } from "@/lib/queues/asaas-webhook-events"
import {
  publishBackofficeEmailCampaignDispatchWake,
  BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC,
  type BackofficeEmailCampaignDispatchWakePayload,
} from "@/lib/queues/backoffice-email-campaign-dispatch"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import { formatQueueProcessingError } from "@/lib/queues/queue-processing-failure"

export type QueueProcessingFailureRepublisher = (
  payload: unknown,
  idempotencyKey: string,
) => Promise<unknown>

/** Asaas: ack após N no consumer; o cron dedicado `retry-asaas-webhook-failures` segue. */
export const QUEUE_PROCESSING_FAILURE_DEDICATED_RETRY_TOPICS: ReadonlySet<string> = new Set([
  ASAAS_WEBHOOK_EVENTS_TOPIC,
])

function parseJsonPayload<T>(payload: Prisma.JsonValue | unknown): T {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as T
  }
  return JSON.parse(String(payload)) as T
}

async function publishOrThrow(
  publish: () => Promise<unknown>,
): Promise<void> {
  const result = await publishWithRetry(publish)
  if (!result.ok) {
    throw result.error instanceof Error
      ? result.error
      : new Error(formatQueueProcessingError(result.error))
  }
}

export const QUEUE_PROCESSING_FAILURE_REPUBLISHERS: Record<string, QueueProcessingFailureRepublisher> =
  {
    [PUBLIC_FORM_METRIC_EVENTS_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishPublicFormMetricEvent(parseJsonPayload<PublicFormMetricQueuePayload>(payload), {
          idempotencyKey,
        }),
      ),
    [PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishPublicFormSubmissionEvent(
          parseJsonPayload<PublicFormSubmissionBackgroundJob>(payload),
          { idempotencyKey },
        ),
      ),
    [PUBLIC_FORM_PROGRESS_EVENTS_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishPublicFormProgressEvent(
          parseJsonPayload<PublicFormProgressQueuePayload>(payload),
          { idempotencyKey },
        ),
      ),
    [RADAR_ENGAGEMENT_SCORE_UPDATES_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishRadarEngagementScoreUpdate(
          parseJsonPayload<RadarEngagementScoreUpdatePayload>(payload),
          { idempotencyKey },
        ),
      ),
    [RESEND_WEBHOOK_RADAR_EVENTS_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishResendWebhookRadarEvent(
          parseJsonPayload<ResendWebhookRadarEventPayload>(payload),
          { idempotencyKey },
        ),
      ),
    [RADAR_EMAIL_CONTACT_SYNC_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishRadarEmailContactSyncWake(
          parseJsonPayload<RadarEmailContactSyncWakePayload>(payload),
          { idempotencyKey },
        ),
      ),
    [RADAR_PROFILE_SYNC_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishRadarProfileSync(parseJsonPayload<RadarProfileSyncPayload>(payload), {
          idempotencyKey,
        }),
      ),
    [RADAR_PIXEL_EVENTS_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishRadarPixelEvent(parseJsonPayload<RadarPixelEventPayload>(payload), {
          idempotencyKey,
        }),
      ),
    [RADAR_BULK_IMPORT_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishRadarBulkImportBatch(parseJsonPayload<RadarBulkImportPayload>(payload), {
          idempotencyKey,
        }),
      ),
    [WHATSAPP_RADAR_EVENTS_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishWhatsappRadarEvent(parseJsonPayload<WhatsappRadarEventPayload>(payload), {
          idempotencyKey,
        }),
      ),
    [EMAIL_CAMPAIGN_DISPATCH_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishEmailCampaignDispatchWake(
          parseJsonPayload<EmailCampaignDispatchWakePayload>(payload),
          { idempotencyKey },
        ),
      ),
    [RESEND_WEBHOOK_EMAILLOG_EVENTS_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishResendWebhookEmailLogEvent(
          parseJsonPayload<ResendWebhookEmailLogEventPayload>(payload),
          { idempotencyKey },
        ),
      ),
    [BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC]: (payload, idempotencyKey) =>
      publishOrThrow(() =>
        publishBackofficeEmailCampaignDispatchWake(
          parseJsonPayload<BackofficeEmailCampaignDispatchWakePayload>(payload),
          { idempotencyKey },
        ),
      ),
  }
