import { describe, expect, it } from "bun:test"

import {
  isFabricatedByDispatcher,
  planFormCompletedOccurredAtBackfill,
  summarizeSkipReasons,
  type ClocklessMetricEvent,
} from "@/lib/public-forms/backfill-form-completed-occurred-at"

const ACEITE = new Date("2026-08-20T22:10:31.000Z")
const DISPATCH_ACEITE = new Date("2026-08-21T10:00:00.000Z")

function event(overrides: Partial<ClocklessMetricEvent> = {}): ClocklessMetricEvent {
  return {
    id: "evt-1",
    eventKey: "session-1:form_completed",
    eventType: "form_completed",
    visitorSessionId: "session-1",
    submission: {
      id: "sub-1",
      requestKey: "req-real-1",
      createdAt: ACEITE,
      dispatchAcceptedAt: null,
    },
    ...overrides,
  }
}

describe("backfill de occurredAt — plano (T-M3.3)", () => {
  it("aceite real recebe o createdAt da submissão", () => {
    const plan = planFormCompletedOccurredAtBackfill([event()])

    expect(plan.updates).toEqual([
      { eventId: "evt-1", eventKey: "session-1:form_completed", occurredAt: ACEITE },
    ])
    expect(plan.skipped).toHaveLength(0)
  })

  it("casca do dispatcher fica de fora da correção de data", () => {
    // `progress:` sobrevivente = ninguém enviou; datar isso inventaria conversão.
    const plan = planFormCompletedOccurredAtBackfill([
      event({
        id: "evt-casca",
        submission: {
          id: "sub-casca",
          requestKey: "progress:session_abcdefghij:pub-1",
          createdAt: ACEITE,
          dispatchAcceptedAt: null,
        },
      }),
    ])

    expect(plan.updates).toHaveLength(0)
    expect(plan.skipped[0].reason).toBe("fabricada_pelo_dispatcher")
  })

  it("sem createdAt cai no dispatchAcceptedAt", () => {
    const plan = planFormCompletedOccurredAtBackfill([
      event({
        submission: {
          id: "sub-1",
          requestKey: "req-real-1",
          createdAt: null,
          dispatchAcceptedAt: DISPATCH_ACEITE,
        },
      }),
    ])

    expect(plan.updates[0].occurredAt).toEqual(DISPATCH_ACEITE)
  })

  it("evento sem submissão e submissão sem âncora nenhuma são pulados, nunca datados por hoje", () => {
    const plan = planFormCompletedOccurredAtBackfill([
      event({ id: "evt-orfao", submission: null }),
      event({
        id: "evt-sem-ancora",
        submission: {
          id: "sub-2",
          requestKey: "req-real-2",
          createdAt: null,
          dispatchAcceptedAt: null,
        },
      }),
    ])

    expect(plan.updates).toHaveLength(0)
    expect(summarizeSkipReasons(plan.skipped)).toEqual({
      submissao_nao_encontrada: 1,
      fabricada_pelo_dispatcher: 0,
      sem_ancora_de_aceite: 1,
    })
  })

  it("população real de 24/08: 304 cascas ficam fora, 20 aceites entram", () => {
    const cascas = Array.from({ length: 304 }, (_, index) =>
      event({
        id: `casca-${index}`,
        eventKey: `casca-${index}:form_completed`,
        submission: {
          id: `sub-casca-${index}`,
          requestKey: `progress:session_${index}:pub-1`,
          createdAt: ACEITE,
          dispatchAcceptedAt: null,
        },
      })
    )
    const aceites = Array.from({ length: 20 }, (_, index) =>
      event({ id: `aceite-${index}`, eventKey: `aceite-${index}:form_completed` })
    )

    const plan = planFormCompletedOccurredAtBackfill([...cascas, ...aceites])

    expect(plan.updates).toHaveLength(20)
    expect(summarizeSkipReasons(plan.skipped).fabricada_pelo_dispatcher).toBe(304)
  })

  it("isFabricatedByDispatcher só olha o prefixo do requestKey", () => {
    const base = { id: "s", createdAt: ACEITE, dispatchAcceptedAt: null }
    expect(isFabricatedByDispatcher({ ...base, requestKey: "progress:x" })).toBe(true)
    expect(isFabricatedByDispatcher({ ...base, requestKey: "req:progress:x" })).toBe(false)
  })
})
