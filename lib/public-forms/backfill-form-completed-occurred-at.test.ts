import { describe, expect, it } from "bun:test"

import {
  isFabricatedByDispatcher,
  planFormCompletedOccurredAtBackfill,
  selectSubmissionForEvent,
  summarizeSkipReasons,
  type ClocklessMetricEvent,
  type SubmissionAnchor,
} from "@/lib/public-forms/backfill-form-completed-occurred-at"

const ACEITE = new Date("2026-08-20T22:10:31.000Z")
const EVENTO_NASCEU = new Date("2026-08-22T23:07:04.000Z")
const DISPATCH_ACEITE = new Date("2026-08-21T10:00:00.000Z")

function anchor(overrides: Partial<SubmissionAnchor> = {}): SubmissionAnchor {
  return {
    id: "sub-1",
    requestKey: "req-real-1",
    createdAt: ACEITE,
    dispatchAcceptedAt: null,
    emailLogId: null,
    ...overrides,
  }
}

function event(overrides: Partial<ClocklessMetricEvent> = {}): ClocklessMetricEvent {
  return {
    id: "evt-1",
    eventKey: "session-1:form_completed",
    eventType: "form_completed",
    visitorSessionId: "session-1",
    createdAt: EVENTO_NASCEU,
    attributionEmailLogId: null,
    submissionCandidates: [anchor()],
    ...overrides,
  }
}

describe("backfill de occurredAt — plano (T-M3.3)", () => {
  it("aceite real recebe o relógio do aceite", () => {
    const plan = planFormCompletedOccurredAtBackfill([event()])

    expect(plan.updates).toEqual([
      { eventId: "evt-1", eventKey: "session-1:form_completed", occurredAt: ACEITE },
    ])
    expect(plan.skipped).toHaveLength(0)
  })

  it("dispatchAcceptedAt vence createdAt — parcial promovida do /progress", () => {
    // `createdAt` da parcial é o início do preenchimento, não o envio.
    const plan = planFormCompletedOccurredAtBackfill([
      event({
        submissionCandidates: [
          anchor({ createdAt: new Date("2026-08-20T19:05:00.000Z"), dispatchAcceptedAt: ACEITE }),
        ],
      }),
    ])

    expect(plan.updates[0].occurredAt).toEqual(ACEITE)
  })

  it("casca do dispatcher fica de fora da correção de data", () => {
    const plan = planFormCompletedOccurredAtBackfill([
      event({
        id: "evt-casca",
        submissionCandidates: [
          anchor({ id: "sub-casca", requestKey: "progress:session_abcdefghij:pub-1" }),
        ],
      }),
    ])

    expect(plan.updates).toHaveLength(0)
    expect(plan.skipped[0].reason).toBe("fabricada_pelo_dispatcher")
  })

  it("sem dispatchAcceptedAt nem createdAt, o evento é pulado — nunca datado por hoje", () => {
    const plan = planFormCompletedOccurredAtBackfill([
      event({ id: "evt-orfao", submissionCandidates: [] }),
      event({
        id: "evt-sem-ancora",
        submissionCandidates: [anchor({ createdAt: null, dispatchAcceptedAt: null })],
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
        submissionCandidates: [
          anchor({ id: `sub-casca-${index}`, requestKey: `progress:session_${index}:pub-1` }),
        ],
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
    expect(isFabricatedByDispatcher(anchor({ requestKey: "progress:x" }))).toBe(true)
    expect(isFabricatedByDispatcher(anchor({ requestKey: "req:progress:x" }))).toBe(false)
  })
})

describe("selectSubmissionForEvent — sessão de 30 dias com várias submissões", () => {
  it("aceite real vence a casca abandonada da mesma sessão", () => {
    // Regressão do achado do #1029: a casca era a mais antiga e vencia, então o
    // `form_completed` REAL herdava a casca, era pulado como fabricado e ficava
    // com `occurredAt` NULL — o bug que o backfill deveria corrigir.
    const casca = anchor({
      id: "sub-casca",
      requestKey: "progress:session-1:pub-1",
      createdAt: new Date("2026-08-19T10:00:00.000Z"),
    })
    const real = anchor({ id: "sub-real", createdAt: ACEITE })

    const selected = selectSubmissionForEvent(event({ submissionCandidates: [casca, real] }))

    expect(selected?.id).toBe("sub-real")
  })

  it("atribuição do eventKey escolhe a submissão da campanha certa", () => {
    const campanhaA = anchor({ id: "sub-a", emailLogId: "log-a", createdAt: new Date("2026-08-01T10:00:00.000Z") })
    const campanhaB = anchor({ id: "sub-b", emailLogId: "log-b", createdAt: new Date("2026-08-15T10:00:00.000Z") })

    const selected = selectSubmissionForEvent(
      event({
        eventKey: "session-1:form_completed:el:log-b",
        attributionEmailLogId: "log-b",
        submissionCandidates: [campanhaA, campanhaB],
      })
    )

    expect(selected?.id).toBe("sub-b")
  })

  it("sem atribuição, vence a mais recente que já existia quando o evento nasceu", () => {
    const antiga = anchor({ id: "sub-antiga", createdAt: new Date("2026-08-01T10:00:00.000Z") })
    const recente = anchor({ id: "sub-recente", createdAt: new Date("2026-08-22T10:00:00.000Z") })
    const posterior = anchor({ id: "sub-posterior", createdAt: new Date("2026-08-30T10:00:00.000Z") })

    const selected = selectSubmissionForEvent(
      event({ submissionCandidates: [antiga, recente, posterior] })
    )

    expect(selected?.id).toBe("sub-recente")
  })

  it("sessão só com casca continua sendo casca — não inventa aceite", () => {
    const selected = selectSubmissionForEvent(
      event({
        submissionCandidates: [anchor({ id: "sub-casca", requestKey: "progress:session-1:pub-1" })],
      })
    )

    expect(selected?.id).toBe("sub-casca")
    expect(isFabricatedByDispatcher(selected!)).toBe(true)
  })

  it("sessão sem submissão nenhuma devolve null", () => {
    expect(selectSubmissionForEvent(event({ submissionCandidates: [] }))).toBeNull()
  })

  it("DISPATCH_ACEITE não é usado quando o createdAt já é o aceite", () => {
    const plan = planFormCompletedOccurredAtBackfill([
      event({ submissionCandidates: [anchor({ dispatchAcceptedAt: DISPATCH_ACEITE })] }),
    ])

    expect(plan.updates[0].occurredAt).toEqual(DISPATCH_ACEITE)
  })
})
