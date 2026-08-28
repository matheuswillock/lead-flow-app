import { describe, expect, it } from "bun:test"
import {
  selectEvictablePublicFormOutboxRecords,
  type PublicFormBrowserOutboxKind,
  type PublicFormBrowserOutboxRecord,
} from "./browser-event-outbox"

const NOW = 1_000_000

function record(
  eventId: string,
  kind: PublicFormBrowserOutboxKind,
  createdAt: number,
  expiresAt: number = NOW + 60_000,
): PublicFormBrowserOutboxRecord {
  return {
    eventId,
    kind,
    endpoint: "/endpoint",
    body: {},
    attempts: 0,
    nextAttemptAt: NOW,
    expiresAt,
    createdAt,
  }
}

describe("selectEvictablePublicFormOutboxRecords", () => {
  it("remove registros expirados", () => {
    const expired = record("expired", "behavior", 1, NOW - 1)
    const alive = record("alive", "behavior", 2)

    const removable = selectEvictablePublicFormOutboxRecords([expired, alive], NOW, 10)

    expect(removable.map((item) => item.eventId)).toEqual(["expired"])
  })

  it("acima do limite, mantém a submissão e evict os comportamentais mais antigos", () => {
    const behaviors = Array.from({ length: 3 }, (_, index) =>
      record(`behavior-${index}`, "behavior", index + 1),
    )
    const submission = record("submission-1", "submission", 0)

    const removable = selectEvictablePublicFormOutboxRecords(
      [...behaviors, submission],
      NOW,
      3,
    )

    expect(removable.map((item) => item.eventId)).toEqual(["behavior-0"])
  })

  it("prioriza submissão > resposta > comportamento na retenção", () => {
    const submission = record("submission-1", "submission", 1)
    const answer = record("answer-1", "answer", 2)
    const behaviorNew = record("behavior-new", "behavior", 4)
    const behaviorOld = record("behavior-old", "behavior", 3)

    const removable = selectEvictablePublicFormOutboxRecords(
      [behaviorOld, behaviorNew, answer, submission],
      NOW,
      2,
    )

    expect(removable.map((item) => item.eventId).sort()).toEqual([
      "behavior-new",
      "behavior-old",
    ])
  })

  it("dentro do limite não remove nada", () => {
    const records = [
      record("submission-1", "submission", 1),
      record("answer-1", "answer", 2),
      record("behavior-1", "behavior", 3),
    ]

    expect(selectEvictablePublicFormOutboxRecords(records, NOW, 10)).toEqual([])
  })
})
