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
 * PR2.3: bifurcação crítico/não-crítico removida — TODO eventType de funil
 * (visitante) é queue-first, sem Prisma no happy path da rota pública.
 * Mantido por compatibilidade/documentação; não é mais usado para decidir
 * caminho direto vs. fila em `PublicFormsUseCase.recordMetric`.
 */
export const CRITICAL_PUBLIC_FORM_METRIC_EVENT_TYPES = [
  "form_viewed",
  "form_started",
  "question_answered",
  "form_completed",
] as const;

export type CriticalPublicFormMetricEventType =
  (typeof CRITICAL_PUBLIC_FORM_METRIC_EVENT_TYPES)[number];

/** Tipos persistidos no servidor (submission) e publicados na mesma fila — não são queue-first no POST público. */
export type ServerPublicFormMetricEventType =
  | "lead_created"
  | "lead_attached"
  | "meeting_scheduled";

export type PublicFormMetricQueueEventType =
  | PublicFormMetricEventInput["eventType"]
  | ServerPublicFormMetricEventType;

const queue = new QueueClient({ region: "gru1" });

export type PublicFormMetricQueuePayload = {
  publicId: string;
  schemaVersion?: 1;
  eventId?: string | null;
  occurredAt?: string;
  eventKey: string;
  eventType: PublicFormMetricQueueEventType;
  questionId: string | null;
  visitorSessionId: string;
  origin: Record<string, unknown>;
  /** Ver `PublicFormMetricEventInput.answerMappingKey`/`answerValue`. mappingKey só no servidor. */
  answerMappingKey: string | null;
  answerValue: unknown;
  /** Jornada: página corrente no momento do evento. */
  pageId?: string | null;
  pageIndex?: number | null;
  /** `form_validation_failed`: IDs e códigos de erro, nunca o valor inválido. */
  validationCodes?: { questionId: string; code: string }[];
  /** `false` no POST público `/events`; identidade originada no Progress usa `true`. */
  createCrmLead: boolean;
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
    eventType: PublicFormMetricQueueEventType;
  },
): PublicFormMetricQueuePayload {
  return {
    publicId,
    schemaVersion: input.schemaVersion ?? 1,
    eventId: input.eventId ?? null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    eventKey: input.eventKey,
    eventType: input.eventType,
    questionId: input.questionId ?? null,
    visitorSessionId: input.visitorSessionId,
    origin: input.origin ?? {},
    answerMappingKey: input.answerMappingKey ?? null,
    answerValue: input.answerValue ?? null,
    pageId: input.pageId ?? null,
    pageIndex: input.pageIndex ?? null,
    validationCodes: input.validationCodes,
    createCrmLead: input.createCrmLead !== false,
    receivedAt: new Date().toISOString(),
  };
}

export async function publishPublicFormMetricEvent(
  payload: PublicFormMetricQueuePayload,
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(PUBLIC_FORM_METRIC_EVENTS_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? payload.eventKey,
    retentionSeconds: PUBLIC_FORM_METRIC_EVENTS_RETENTION_SECONDS,
  });
}

/**
 * Publish após persist local no servidor. Falha de fila não reverte o persist.
 * Retorna `false` para o caller processar o evento no mesmo isolate (Radar-gate
 * A+C) — o cron/retry do consumer não se aplica a este caminho.
 */
export async function publishServerPublicFormMetricEvent(
  payload: PublicFormMetricQueuePayload,
  logPrefix: string,
  options?: { idempotencyKey?: string },
): Promise<boolean> {
  try {
    await publishPublicFormMetricEvent(payload, options);
    return true;
  } catch (error) {
    console.error(`[${logPrefix}] ${PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG}`, {
      tag: PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
      publicId: payload.publicId,
      eventType: payload.eventType,
      eventKey: payload.eventKey,
      error,
    });
    return false;
  }
}

export const { handleCallback: handlePublicFormMetricEventsCallback } = queue;
