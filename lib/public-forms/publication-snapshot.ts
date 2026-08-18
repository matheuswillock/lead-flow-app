import { Prisma } from "@prisma/client"
import type { PublicFormAnswerInput, PublicFormSnapshot } from "@/lib/public-forms/types"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function parsePublicFormSnapshot(snapshot: unknown): PublicFormSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") return null
  const questions = (snapshot as { questions?: unknown }).questions
  if (!Array.isArray(questions)) return null
  return snapshot as PublicFormSnapshot
}

export function listSnapshotQuestionIds(snapshot: unknown): string[] {
  const parsed = parsePublicFormSnapshot(snapshot)
  if (!parsed) return []
  return parsed.questions.map((question) => question.id).filter(Boolean)
}

export function snapshotContainsQuestion(snapshot: unknown, questionId: string): boolean {
  return listSnapshotQuestionIds(snapshot).includes(questionId)
}

export function snapshotContainsAllQuestions(snapshot: unknown, questionIds: string[]): boolean {
  if (questionIds.length === 0) return true
  const ids = new Set(listSnapshotQuestionIds(snapshot))
  return questionIds.every((questionId) => ids.has(questionId))
}

export function isStaleQuestionIdForeignKey(
  error: unknown,
  questionId: string | null | undefined,
): boolean {
  return Boolean(
    questionId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003" &&
      String(error.meta?.constraint ?? "").includes("questionId"),
  )
}

export function mapAnswersForPersistence(
  snapshot: PublicFormSnapshot,
  visibleAnswers: PublicFormAnswerInput[],
) {
  return visibleAnswers.flatMap((answer) => {
    const question = snapshot.questions.find((item) => item.id === answer.questionId)
    if (!question) return []
    return [
      {
        questionId: answer.questionId,
        value: answer.value as Prisma.InputJsonValue,
        questionSnapshot: json(question),
      },
    ]
  })
}
