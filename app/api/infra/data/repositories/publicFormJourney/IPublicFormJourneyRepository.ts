import type {
  PublicFormJourneyEvent,
  PublicFormJourneySessionProjection,
} from "@/lib/public-forms/journey-session"

export type RecordJourneyEventInput = {
  formId: string
  publicationId: string
  visitorSessionId: string
  event: PublicFormJourneyEvent
}

export type RecordJourneyEventResult = {
  sessionId: string
  projection: PublicFormJourneySessionProjection
  /** Evento server-side derivado da transição, quando houver. */
  derivedEvent: "form_resumed" | null
}

export type AbandonedJourneyCandidate = {
  sessionId: string
  formId: string
  /** `publicId` do formulário — o publisher da fila indexa por ele, não por `formId`. */
  publicId: string
  publicationId: string
  visitorSessionId: string
  /** `lastActivityAt` que originou o abandono — compõe a chave causal. */
  lastActivityAt: Date
  abandonmentCount: number
}

/**
 * Persistência da jornada do visitante.
 *
 * `recordJourneyEvent` é idempotente pela chave única
 * `(publicationId, visitorSessionId)`: entregas duplicadas do mesmo evento
 * convergem para a mesma projeção.
 */
export interface IPublicFormJourneyRepository {
  recordJourneyEvent(input: RecordJourneyEventInput): Promise<RecordJourneyEventResult>

  /**
   * Reivindica sessões inativas para abandono usando `FOR UPDATE SKIP LOCKED`,
   * marcando-as no mesmo comando. Dois crons concorrentes nunca reivindicam a
   * mesma sessão, e `completed` jamais é candidata.
   */
  claimAbandonedJourneySessions(input: {
    idleBefore: Date
    limit: number
  }): Promise<AbandonedJourneyCandidate[]>

  /** Totais da jornada por estado, para o funil de analytics. */
  countJourneyStates(input: {
    formId: string
    publicationId?: string
    from?: Date
    to?: Date
  }): Promise<PublicFormJourneyStateTotals>
}

export type PublicFormJourneyStateTotals = {
  active: number
  abandoned: number
  completed: number
  abandonmentEvents: number
}
