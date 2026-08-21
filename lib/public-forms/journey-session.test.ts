import { describe, expect, it } from "bun:test"
import {
  applyPublicFormJourneyEvent,
  buildJourneyAbandonmentEventKey,
  createInitialJourneyProjection,
  type PublicFormJourneySessionProjection,
} from "./journey-session"

const T0 = new Date("2026-08-21T10:00:00.000Z")
const T1 = new Date("2026-08-21T10:05:00.000Z")

function projection(
  overrides: Partial<PublicFormJourneySessionProjection> = {},
): PublicFormJourneySessionProjection {
  return { ...createInitialJourneyProjection(T0), ...overrides }
}

describe("applyPublicFormJourneyEvent", () => {
  it("avanço de página atualiza a página corrente", () => {
    const result = applyPublicFormJourneyEvent(projection(), {
      eventType: "page_advanced",
      occurredAt: T1,
      pageId: "2f1c8a4e-0000-4000-8000-000000000001",
      pageIndex: 2,
    })

    expect(result.changed).toBe(true)
    expect(result.projection.currentPageIndex).toBe(2)
    expect(result.projection.lastActivityAt).toEqual(T1)
  })

  it("exit intent registra a intenção sem abandonar", () => {
    const result = applyPublicFormJourneyEvent(projection(), {
      eventType: "form_exit_intent",
      occurredAt: T1,
    })

    expect(result.projection.state).toBe("active")
    expect(result.projection.lastExitIntentAt).toEqual(T1)
    expect(result.projection.lastAbandonedAt).toBeNull()
  })

  it("primeira ação após abandono retoma e emite form_resumed", () => {
    const abandoned = projection({ state: "abandoned", lastAbandonedAt: T0, abandonmentCount: 1 })

    const result = applyPublicFormJourneyEvent(abandoned, {
      eventType: "question_focused",
      occurredAt: T1,
    })

    expect(result.projection.state).toBe("active")
    expect(result.projection.lastResumedAt).toEqual(T1)
    expect(result.derivedEvent).toBe("form_resumed")
    expect(result.projection.abandonmentCount).toBe(1)
  })

  it("sessão concluída nunca volta para abandonada nem ativa", () => {
    const completed = projection({ state: "completed", completedAt: T0 })

    for (const eventType of ["question_focused", "page_advanced", "form_exit_intent"] as const) {
      const result = applyPublicFormJourneyEvent(completed, { eventType, occurredAt: T1 })
      expect(result.projection.state).toBe("completed")
      expect(result.changed).toBe(false)
    }
  })

  it("form_completed conclui a jornada e preenche submittedAt", () => {
    const result = applyPublicFormJourneyEvent(projection(), {
      eventType: "form_completed",
      occurredAt: T1,
    })

    expect(result.projection.state).toBe("completed")
    expect(result.projection.completedAt).toEqual(T1)
    expect(result.projection.submittedAt).toEqual(T1)
  })

  it("tentativa de submit marca submittedAt sem concluir", () => {
    const result = applyPublicFormJourneyEvent(projection(), {
      eventType: "form_submit_attempted",
      occurredAt: T1,
    })

    expect(result.projection.state).toBe("active")
    expect(result.projection.submittedAt).toEqual(T1)
  })

  it("evento atrasado não regride a última atividade", () => {
    const current = projection({ lastActivityAt: T1 })

    const result = applyPublicFormJourneyEvent(current, {
      eventType: "question_viewed",
      occurredAt: T0,
    })

    expect(result.projection.lastActivityAt).toEqual(T1)
  })

  it("evento fora da taxonomia de jornada não altera a projeção", () => {
    const result = applyPublicFormJourneyEvent(projection(), {
      eventType: "lead_created",
      occurredAt: T1,
    })

    expect(result.changed).toBe(false)
  })
})

describe("buildJourneyAbandonmentEventKey", () => {
  it("é determinística por sessão + lastActivityAt", () => {
    const key = buildJourneyAbandonmentEventKey("session_abcdefghij", T0)

    expect(key).toBe("journey:session_abcdefghij:abandoned:2026-08-21T10:00:00.000Z")
    expect(buildJourneyAbandonmentEventKey("session_abcdefghij", T0)).toBe(key)
  })

  it("nova inatividade gera outra chave, permitindo reabandono", () => {
    expect(buildJourneyAbandonmentEventKey("session_abcdefghij", T1)).not.toBe(
      buildJourneyAbandonmentEventKey("session_abcdefghij", T0),
    )
  })
})
