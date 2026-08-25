import { describe, expect, it } from "bun:test"

import {
  countDistinctSessionsByEventTypeInMemory,
  groupMetricEventsInMemory,
  resolveQuestionIdentityKey,
  type MetricEventRow,
} from "@/lib/public-forms/metric-event-aggregation"

const PUB = "pub-1"

function row(overrides: Partial<MetricEventRow> = {}): MetricEventRow {
  return {
    eventType: "question_answered",
    publicationId: PUB,
    questionId: "q-viva",
    questionSnapshot: { id: "q-viva", title: "E-mail", position: 1, mappingKey: "email" },
    visitorSessionId: "s-1",
    ...overrides,
  }
}

describe("resolveQuestionIdentityKey", () => {
  it("mappingKey manda quando existe", () => {
    expect(resolveQuestionIdentityKey(row())).toBe("key:email")
  })

  it("sem mappingKey, título + posição identificam a pergunta", () => {
    const key = resolveQuestionIdentityKey(
      row({ questionSnapshot: { title: "Qual seu WhatsApp?", position: 2 } })
    )
    expect(key).toBe("title:Qual seu WhatsApp?|2")
  })

  it("sem snapshot utilizável, o id vivo ainda serve", () => {
    expect(resolveQuestionIdentityKey({ questionId: "q-1", questionSnapshot: null })).toBe("id:q-1")
  })

  it("sem snapshot e sem id, não há identidade", () => {
    expect(resolveQuestionIdentityKey({ questionId: null, questionSnapshot: null })).toBeNull()
  })
})

describe("groupMetricEventsInMemory — sessões únicas (T-M4.3)", () => {
  it("conta sessões únicas, não eventos brutos", () => {
    const grouped = groupMetricEventsInMemory([
      row({ visitorSessionId: "s-1" }),
      row({ visitorSessionId: "s-1" }),
      row({ visitorSessionId: "s-1" }),
      row({ visitorSessionId: "s-2" }),
    ])

    expect(grouped).toHaveLength(1)
    expect(grouped[0].uniqueSessions).toBe(2)
    expect(grouped[0]._count._all).toBe(2)
  })

  it("separa por eventType e por publicação", () => {
    const grouped = groupMetricEventsInMemory([
      row({ eventType: "question_viewed" }),
      row({ eventType: "question_answered" }),
      row({ publicationId: "pub-2" }),
    ])

    expect(grouped).toHaveLength(3)
  })
})

describe("T-M4.4 — caso Lista Fria: answers órfãs contam", () => {
  /**
   * Pergunta deletada e recriada no builder: a FK `SetNull` zerou o `questionId`
   * dos eventos antigos. Agrupar pelo id os separava da pergunta viva e a UI
   * exibia "0/0" para uma pergunta com respostas persistidas.
   */
  it("evento com questionId NULL agrupa com o da pergunta viva pelo snapshot", () => {
    const grouped = groupMetricEventsInMemory([
      row({ questionId: null, visitorSessionId: "s-orfa-1" }),
      row({ questionId: null, visitorSessionId: "s-orfa-2" }),
      row({ questionId: "q-recriada", visitorSessionId: "s-viva" }),
    ])

    expect(grouped).toHaveLength(1)
    expect(grouped[0].uniqueSessions).toBe(3)
    expect(grouped[0].questionKey).toBe("key:email")
    // O id vivo vence o NULL: é o que o consumidor usa para casar com a pergunta.
    expect(grouped[0].questionId).toBe("q-recriada")
  })

  it("perguntas distintas continuam distintas mesmo com as duas órfãs", () => {
    const grouped = groupMetricEventsInMemory([
      row({
        questionId: null,
        questionSnapshot: { title: "E-mail", position: 1, mappingKey: "email" },
        visitorSessionId: "s-1",
      }),
      row({
        questionId: null,
        questionSnapshot: { title: "WhatsApp", position: 2, mappingKey: "phone" },
        visitorSessionId: "s-1",
      }),
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped.map((item) => item.questionKey).sort()).toEqual(["key:email", "key:phone"])
  })

  it("11 respostas de uma pergunta órfã nunca somam zero", () => {
    const orphans = Array.from({ length: 11 }, (_, index) =>
      row({ questionId: null, visitorSessionId: `s-${index}` })
    )

    const grouped = groupMetricEventsInMemory(orphans)

    expect(grouped[0].uniqueSessions).toBe(11)
  })
})

describe("countDistinctSessionsByEventTypeInMemory", () => {
  it("uma sessão que dispara o mesmo tipo dez vezes conta uma vez", () => {
    const rows = [
      ...Array.from({ length: 10 }, () => ({ eventType: "form_viewed", visitorSessionId: "s-1" })),
      { eventType: "form_viewed", visitorSessionId: "s-2" },
      { eventType: "form_started", visitorSessionId: "s-1" },
    ]

    expect(countDistinctSessionsByEventTypeInMemory(rows)).toEqual({
      form_viewed: 2,
      form_started: 1,
    })
  })
})
