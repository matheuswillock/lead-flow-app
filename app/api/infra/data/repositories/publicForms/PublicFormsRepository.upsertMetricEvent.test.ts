import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

type UpsertMetricEventArgs = {
  where: { eventKey: string }
  create: { questionId: string | null; questionSnapshot: unknown }
  update: Record<string, never>
}

const upsertMock = mock(async (_args: UpsertMetricEventArgs) => ({}) as unknown)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicFormMetricEvent: {
      upsert: upsertMock,
    },
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

function foreignKeyError(constraint: string) {
  return new Prisma.PrismaClientKnownRequestError("foreign key constraint failed", {
    code: "P2003",
    clientVersion: "test",
    meta: { constraint },
  })
}

const BASE_INPUT = {
  formId: "form-1",
  publicationId: "publication-1",
  visitorSessionId: "session-1",
  eventType: "question_viewed" as const,
  eventKey: "session-1:question_viewed:q1",
  origin: {} as Prisma.InputJsonValue,
}

describe("PublicFormsRepository.upsertMetricEvent", () => {
  beforeEach(() => {
    upsertMock.mockClear()
    upsertMock.mockImplementation(async () => ({}) as unknown)
  })

  function lastCreateArg(callIndex: number) {
    const call = upsertMock.mock.calls[callIndex]
    if (!call) throw new Error(`Expected call at index ${callIndex}`)
    return call[0].create
  }

  it("persiste normalmente quando o questionId ainda existe (sem retry)", async () => {
    const repo = new PublicFormsRepository()
    const questionSnapshot = { id: "question-1", title: "Pergunta" }

    await repo.upsertMetricEvent({
      ...BASE_INPUT,
      questionId: "question-1",
      questionSnapshot,
    })

    expect(upsertMock).toHaveBeenCalledTimes(1)
    const createArg = lastCreateArg(0)
    expect(createArg.questionId).toBe("question-1")
    expect(createArg.questionSnapshot).toEqual(questionSnapshot)
  })

  it("em FK obsoleta (P2003 em questionId), grava sem o FK mas preserva o questionSnapshot", async () => {
    upsertMock.mockImplementationOnce(async () => {
      throw foreignKeyError(
        "corretor_studio_public_form_metric_events_questionId_fkey"
      )
    })

    const repo = new PublicFormsRepository()
    const questionSnapshot = { id: "stale-question", title: "Pergunta removida" }

    await repo.upsertMetricEvent({
      ...BASE_INPUT,
      questionId: "stale-question",
      questionSnapshot,
    })

    expect(upsertMock).toHaveBeenCalledTimes(2)
    const retryCreateArg = lastCreateArg(1)
    expect(retryCreateArg.questionId).toBeNull()
    expect(retryCreateArg.questionSnapshot).toEqual(questionSnapshot)
  })

  it("relança erros que não são FK obsoleta de questionId", async () => {
    upsertMock.mockImplementationOnce(async () => {
      throw foreignKeyError("corretor_studio_public_form_metric_events_publicationId_fkey")
    })

    const repo = new PublicFormsRepository()

    await expect(
      repo.upsertMetricEvent({
        ...BASE_INPUT,
        questionId: "question-1",
        questionSnapshot: { id: "question-1" },
      })
    ).rejects.toThrow("foreign key constraint failed")

    expect(upsertMock).toHaveBeenCalledTimes(1)
  })
})
