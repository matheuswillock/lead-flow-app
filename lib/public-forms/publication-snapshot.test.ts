import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  isStaleQuestionIdForeignKey,
  listSnapshotQuestionIds,
  mapAnswersForPersistence,
  parsePublicFormSnapshot,
  questionIdFromSnapshot,
  resolveStoredSubmissionAnswerQuestionId,
  snapshotContainsAllQuestions,
  snapshotContainsQuestion,
} from "./publication-snapshot"

const SNAPSHOT = {
  formId: "form-1",
  questions: [
    { id: "q-1", title: "Nome", type: "text", required: false, scoreWeight: 0, options: [], position: 0 },
    { id: "q-2", title: "Email", type: "email", required: false, scoreWeight: 0, options: [], position: 1 },
  ],
}

describe("publication-snapshot", () => {
  it("lista ids de perguntas do snapshot", () => {
    expect(listSnapshotQuestionIds(SNAPSHOT)).toEqual(["q-1", "q-2"])
    expect(parsePublicFormSnapshot(null)).toBeNull()
    expect(listSnapshotQuestionIds({ foo: 1 })).toEqual([])
  })

  it("verifica se o snapshot contém um id ou o conjunto", () => {
    expect(snapshotContainsQuestion(SNAPSHOT, "q-1")).toBe(true)
    expect(snapshotContainsQuestion(SNAPSHOT, "q-missing")).toBe(false)
    expect(snapshotContainsAllQuestions(SNAPSHOT, ["q-1", "q-2"])).toBe(true)
    expect(snapshotContainsAllQuestions(SNAPSHOT, ["q-1", "q-missing"])).toBe(false)
    expect(snapshotContainsAllQuestions(SNAPSHOT, [])).toBe(true)
  })

  it("mapAnswersForPersistence ignora respostas sem pergunta no snapshot", () => {
    const mapped = mapAnswersForPersistence(SNAPSHOT as never, [
      { questionId: "q-1", value: "Ana" },
      { questionId: "stale", value: "x" },
    ])
    expect(mapped).toHaveLength(1)
    expect(mapped[0]?.questionId).toBe("q-1")
    expect(mapped[0]?.questionSnapshot).toEqual(SNAPSHOT.questions[0])
  })

  it("extrai o id da pergunta a partir do snapshot", () => {
    expect(questionIdFromSnapshot({ id: "q-1", title: "Nome" })).toBe("q-1")
    expect(questionIdFromSnapshot({ title: "sem id" })).toBeNull()
    expect(questionIdFromSnapshot(null)).toBeNull()
    expect(questionIdFromSnapshot(["q-1"])).toBeNull()
  })

  it("recupera o id da resposta persistida sem FK (P2003)", () => {
    expect(resolveStoredSubmissionAnswerQuestionId("q-1", { id: "ignored" })).toBe("q-1")
    expect(resolveStoredSubmissionAnswerQuestionId(null, { id: "q-from-snapshot" })).toBe(
      "q-from-snapshot",
    )
    expect(resolveStoredSubmissionAnswerQuestionId(null, { title: "sem id" })).toBeNull()
  })

  it("reconhece P2003 de FK de questionId", () => {
    const error = new Prisma.PrismaClientKnownRequestError("fk", {
      code: "P2003",
      clientVersion: "test",
      meta: { constraint: "corretor_studio_public_form_metric_events_questionId_fkey" },
    })
    expect(isStaleQuestionIdForeignKey(error, "q-1")).toBe(true)
    expect(isStaleQuestionIdForeignKey(error, null)).toBe(false)
    expect(
      isStaleQuestionIdForeignKey(
        new Prisma.PrismaClientKnownRequestError("fk", {
          code: "P2003",
          clientVersion: "test",
          meta: { constraint: "publicationId_fkey" },
        }),
        "q-1",
      ),
    ).toBe(false)
  })
})
