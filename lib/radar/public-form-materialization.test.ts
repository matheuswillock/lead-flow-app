import { describe, expect, it } from "bun:test"
import {
  applyPublicFormAnswerRevision,
  canonicalizePublicFormAnswerValue,
  isStalePublicFormRevision,
  readMaterializedPublicFormAnswer,
  type PublicFormAnswerRevision,
} from "./public-form-materialization"

const EVENT_OLD = "1a2b3c4d-1111-4aaa-bbbb-c5a4f3f5d001"
const EVENT_NEW = "8b9e6f52-2f68-4f5f-9f9a-c5a4f3f5d002"

function revision(overrides: Partial<PublicFormAnswerRevision> = {}): PublicFormAnswerRevision {
  return {
    formId: "form-1",
    publicationId: "publication-1",
    questionId: "q-1",
    value: "Ana",
    mappingKey: "name",
    answeredAt: new Date("2026-08-21T10:05:00.000Z"),
    sourceEventId: EVENT_NEW,
    ...overrides,
  }
}

function profileWith(answer: Record<string, unknown>) {
  return {
    publicForms: {
      "form-1": { publicationId: "publication-1", answers: { "q-1": answer } },
    },
  }
}

describe("canonicalizePublicFormAnswerValue", () => {
  it("ignora a ordem das chaves de objeto", () => {
    expect(canonicalizePublicFormAnswerValue({ b: 1, a: 2 })).toBe(
      canonicalizePublicFormAnswerValue({ a: 2, b: 1 }),
    )
  })

  it("preserva a ordem de arrays e o tipo dos valores", () => {
    expect(canonicalizePublicFormAnswerValue(["a", "b"])).not.toBe(
      canonicalizePublicFormAnswerValue(["b", "a"]),
    )
    expect(canonicalizePublicFormAnswerValue(1)).not.toBe(canonicalizePublicFormAnswerValue("1"))
  })
})

describe("isStalePublicFormRevision", () => {
  const stored = {
    value: "Ana",
    mappingKey: "name",
    answeredAt: "2026-08-21T10:05:00.000Z",
    sourceEventId: EVENT_NEW,
  }

  it("sem projeção anterior nada é stale", () => {
    expect(isStalePublicFormRevision(null, revision())).toBe(false)
  })

  it("revisão anterior no tempo é descartada", () => {
    const incoming = revision({ answeredAt: new Date("2026-08-21T10:00:00.000Z") })
    expect(isStalePublicFormRevision(stored, incoming)).toBe(true)
  })

  it("revisão posterior no tempo vence", () => {
    const incoming = revision({ answeredAt: new Date("2026-08-21T10:10:00.000Z") })
    expect(isStalePublicFormRevision(stored, incoming)).toBe(false)
  })

  it("empate de timestamp usa o eventId como desempate determinístico", () => {
    const older = revision({
      answeredAt: new Date("2026-08-21T10:05:00.000Z"),
      sourceEventId: EVENT_OLD,
    })
    expect(isStalePublicFormRevision(stored, older)).toBe(true)

    const same = revision({ answeredAt: new Date("2026-08-21T10:05:00.000Z") })
    expect(isStalePublicFormRevision(stored, same)).toBe(false)
  })
})

describe("applyPublicFormAnswerRevision", () => {
  it("materializa a primeira resposta do formulário", () => {
    const decision = applyPublicFormAnswerRevision(null, revision())

    expect(decision.outcome).toBe("applied")
    expect(readMaterializedPublicFormAnswer(decision.profileData, "form-1", "q-1")).toEqual({
      value: "Ana",
      mappingKey: "name",
      answeredAt: "2026-08-21T10:05:00.000Z",
      sourceEventId: EVENT_NEW,
    })
  })

  it("não apaga respostas irmãs nem outros formulários", () => {
    const existing = {
      publicForms: {
        "form-1": {
          publicationId: "publication-1",
          answers: {
            "q-2": {
              value: "irmã",
              mappingKey: null,
              answeredAt: "2026-08-21T09:00:00.000Z",
              sourceEventId: EVENT_OLD,
            },
          },
        },
        "form-2": { publicationId: "publication-2", answers: {} },
      },
      outroDominio: { intacto: true },
    }

    const decision = applyPublicFormAnswerRevision(existing, revision())
    const forms = (decision.profileData.publicForms ?? {}) as Record<string, { answers: object }>

    expect(decision.outcome).toBe("applied")
    expect(Object.keys(forms["form-1"].answers).sort()).toEqual(["q-1", "q-2"])
    expect(forms["form-2"]).toBeDefined()
    expect(decision.profileData.outroDominio).toEqual({ intacto: true })
  })

  it("retry atrasado não substitui a projeção mais nova", () => {
    const existing = profileWith({
      value: "Ana Maria",
      mappingKey: "name",
      answeredAt: "2026-08-21T10:05:00.000Z",
      sourceEventId: EVENT_NEW,
    })

    const decision = applyPublicFormAnswerRevision(
      existing,
      revision({
        value: "Ana",
        answeredAt: new Date("2026-08-21T10:00:00.000Z"),
        sourceEventId: EVENT_OLD,
      }),
    )

    expect(decision.outcome).toBe("stale")
    expect(readMaterializedPublicFormAnswer(decision.profileData, "form-1", "q-1")?.value).toBe(
      "Ana Maria",
    )
  })

  it("valor canônico idêntico não gera revisão", () => {
    const existing = profileWith({
      value: { plano: "familiar", vidas: 3 },
      mappingKey: null,
      answeredAt: "2026-08-21T10:00:00.000Z",
      sourceEventId: EVENT_OLD,
    })

    const decision = applyPublicFormAnswerRevision(
      existing,
      revision({ value: { vidas: 3, plano: "familiar" }, mappingKey: null }),
    )

    expect(decision.outcome).toBe("unchanged")
  })

  it("valor realmente diferente gera revisão e atualiza o envelope causal", () => {
    const existing = profileWith({
      value: "Ana",
      mappingKey: "name",
      answeredAt: "2026-08-21T10:00:00.000Z",
      sourceEventId: EVENT_OLD,
    })

    const decision = applyPublicFormAnswerRevision(existing, revision({ value: "Ana Maria" }))

    expect(decision.outcome).toBe("applied")
    expect(readMaterializedPublicFormAnswer(decision.profileData, "form-1", "q-1")).toMatchObject({
      value: "Ana Maria",
      sourceEventId: EVENT_NEW,
    })
  })

  it("preserva valores não string tipados", () => {
    const decision = applyPublicFormAnswerRevision(
      null,
      revision({ value: ["individual", "familiar"], mappingKey: null }),
    )

    expect(readMaterializedPublicFormAnswer(decision.profileData, "form-1", "q-1")?.value).toEqual([
      "individual",
      "familiar",
    ])
  })
})
