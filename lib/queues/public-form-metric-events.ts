import { QueueClient } from "@vercel/queue";
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types";

/**
 * Tópico oficial dos eventos públicos críticos de funil (SPEC D2).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute do projeto.
 */
export const PUBLIC_FORM_METRIC_EVENTS_TOPIC = "public-form-metric-events";

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const PUBLIC_FORM_METRIC_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7;

/** Tag/log obrigatória quando o publish na fila falha (SPEC / T5). */
export const PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG =
  "public_form_metric_queue_publish_failed";

/**
 * Eventos de funil no caminho queue-first (sem Prisma no happy path da rota pública).
 * Demais tipos permanecem no caminho direto via `recordMetric`.
 */
export const CRITICAL_PUBLIC_FORM_METRIC_EVENT_TYPES = [
  "form_viewed",
  "question_answered",
  "form_completed",
] as const;

export type CriticalPublicFormMetricEventType =
  (typeof CRITICAL_PUBLIC_FORM_METRIC_EVENT_TYPES)[number];

const queue = new QueueClient({ region: "gru1" });

export type PublicFormMetricQueuePayload = {
  publicId: string;
  eventKey: string;
  eventType: CriticalPublicFormMetricEventType | "form_started";
  questionId: string | null;
  visitorSessionId: string;
  origin: Record<string, unknown>;
  receivedAt: string;
};

export function isCriticalPublicFormMetricEvent(
  eventType: PublicFormMetricEventInput["eventType"],
): eventType is CriticalPublicFormMetricEventType {
  return (CRITICAL_PUBLIC_FORM_METRIC_EVENT_TYPES as readonly string[]).includes(
    eventType,
  );
}

export function buildPublicFormMetricQueuePayload(
  publicId: string,
  input: PublicFormMetricEventInput & {
    eventType: CriticalPublicFormMetricEventType;
  },
): PublicFormMetricQueuePayload {
  return {
    publicId,
    eventKey: input.eventKey,
    eventType: input.eventType,
    questionId: input.questionId ?? null,
    visitorSessionId: input.visitorSessionId,
    origin: input.origin ?? {},
    receivedAt: new Date().toISOString(),
  };
}

export async function publishPublicFormMetricEvent(
  payload: PublicFormMetricQueuePayload,
): Promise<{ messageId: string | null }> {
  return queue.send(PUBLIC_FORM_METRIC_EVENTS_TOPIC, payload, {
    idempotencyKey: payload.eventKey,
    retentionSeconds: PUBLIC_FORM_METRIC_EVENTS_RETENTION_SECONDS,
  });
}

export const { handleCallback: handlePublicFormMetricEventsCallback } = queue;
