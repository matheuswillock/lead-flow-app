import type { PublicFormEventType } from "./types"

/**
 * Transições da sessão de jornada.
 *
 * Módulo puro: não conhece Prisma. O repositório aplica o resultado dentro do
 * upsert idempotente por `(publicationId, visitorSessionId)`.
 *
 * Regras que não podem ser reinterpretadas:
 * - Sessão `completed` nunca volta para `abandoned` nem para `active`.
 * - `form_exit_intent` registra a intenção mas não abandona — só o cron, após
 *   30 minutos de inatividade, marca `abandoned`.
 * - A primeira ação depois de um abandono retoma a sessão e conta a retomada.
 */

export const PUBLIC_FORM_ABANDONMENT_IDLE_MS = 30 * 60_000

export type PublicFormJourneyState = "active" | "abandoned" | "completed"

export type PublicFormJourneySessionProjection = {
  state: PublicFormJourneyState
  lastActivityAt: Date
  currentPageId: string | null
  currentPageIndex: number | null
  lastExitIntentAt: Date | null
  lastAbandonedAt: Date | null
  lastResumedAt: Date | null
  abandonmentCount: number
  submittedAt: Date | null
  completedAt: Date | null
}

export type PublicFormJourneyEvent = {
  eventType: PublicFormEventType
  occurredAt: Date
  pageId?: string | null
  pageIndex?: number | null
}

export type PublicFormJourneyTransition = {
  projection: PublicFormJourneySessionProjection
  /** Evento server-side a emitir junto da transição, quando houver. */
  derivedEvent: "form_resumed" | null
  changed: boolean
}

const ACTIVITY_EVENTS = new Set<PublicFormEventType>([
  "form_viewed",
  "form_started",
  "question_viewed",
  "question_skipped",
  "question_focused",
  "question_answered",
  "page_viewed",
  "page_advanced",
  "page_returned",
  "form_submit_attempted",
  "form_validation_failed",
  "form_completed",
])

const PAGE_EVENTS = new Set<PublicFormEventType>(["page_viewed", "page_advanced", "page_returned"])

export function createInitialJourneyProjection(occurredAt: Date): PublicFormJourneySessionProjection {
  return {
    state: "active",
    lastActivityAt: occurredAt,
    currentPageId: null,
    currentPageIndex: null,
    lastExitIntentAt: null,
    lastAbandonedAt: null,
    lastResumedAt: null,
    abandonmentCount: 0,
    submittedAt: null,
    completedAt: null,
  }
}

export function applyPublicFormJourneyEvent(
  current: PublicFormJourneySessionProjection,
  event: PublicFormJourneyEvent,
): PublicFormJourneyTransition {
  // Terminal: uma jornada concluída não é reaberta por evento atrasado.
  if (current.state === "completed") {
    return { projection: current, derivedEvent: null, changed: false }
  }

  // Exit intent não abandona — só registra a intenção e mantém a atividade.
  if (event.eventType === "form_exit_intent") {
    if (current.lastExitIntentAt && current.lastExitIntentAt >= event.occurredAt) {
      return { projection: current, derivedEvent: null, changed: false }
    }
    return {
      projection: { ...current, lastExitIntentAt: event.occurredAt },
      derivedEvent: null,
      changed: true,
    }
  }

  if (!ACTIVITY_EVENTS.has(event.eventType)) {
    return { projection: current, derivedEvent: null, changed: false }
  }

  const resumed = current.state === "abandoned"
  const next: PublicFormJourneySessionProjection = {
    ...current,
    state: "active",
    lastActivityAt:
      event.occurredAt > current.lastActivityAt ? event.occurredAt : current.lastActivityAt,
    ...(resumed ? { lastResumedAt: event.occurredAt } : {}),
    ...(PAGE_EVENTS.has(event.eventType)
      ? {
          currentPageId: event.pageId ?? current.currentPageId,
          currentPageIndex: event.pageIndex ?? current.currentPageIndex,
        }
      : {}),
  }

  if (event.eventType === "form_submit_attempted" && !next.submittedAt) {
    next.submittedAt = event.occurredAt
  }
  if (event.eventType === "form_completed") {
    next.state = "completed"
    next.completedAt = event.occurredAt
    if (!next.submittedAt) next.submittedAt = event.occurredAt
  }

  return {
    projection: next,
    derivedEvent: resumed ? "form_resumed" : null,
    changed: true,
  }
}

/** Chave causal do abandono: sessão + o `lastActivityAt` que o originou. */
export function buildJourneyAbandonmentEventKey(
  visitorSessionId: string,
  lastActivityAt: Date,
): string {
  return `journey:${visitorSessionId}:abandoned:${lastActivityAt.toISOString()}`
}

export function buildJourneyResumeEventKey(
  visitorSessionId: string,
  resumedAt: Date,
): string {
  return `journey:${visitorSessionId}:resumed:${resumedAt.toISOString()}`
}
