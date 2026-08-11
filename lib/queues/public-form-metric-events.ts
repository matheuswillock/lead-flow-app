import { QueueClient } from "@vercel/queue";

/**
 * Tópico oficial dos eventos públicos críticos de funil (SPEC D2).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute do projeto.
 */
export const PUBLIC_FORM_METRIC_EVENTS_TOPIC = "public-form-metric-events";

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const PUBLIC_FORM_METRIC_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7;

const queue = new QueueClient({ region: "gru1" });

export type PublicFormMetricQueuePayload = {
  publicId: string;
  eventKey: string;
  eventType: "form_viewed" | "form_started" | "question_answered" | "form_completed";
  questionId: string | null;
  visitorSessionId: string;
  origin: Record<string, unknown>;
  receivedAt: string;
};

export async function publishPublicFormMetricEvent(
  payload: PublicFormMetricQueuePayload,
): Promise<{ messageId: string | null }> {
  return queue.send(PUBLIC_FORM_METRIC_EVENTS_TOPIC, payload, {
    idempotencyKey: payload.eventKey,
    retentionSeconds: PUBLIC_FORM_METRIC_EVENTS_RETENTION_SECONDS,
  });
}

export const { handleCallback: handlePublicFormMetricEventsCallback } = queue;
