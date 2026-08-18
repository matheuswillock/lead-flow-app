import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const deleteManyMock = mock(async () => ({ count: 0 }))
const upsertMock = mock(async () => ({}))
const createMock = mock(async () => ({}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: {
      publicFormAnswer: {
        deleteMany: typeof deleteManyMock
        upsert: typeof upsertMock
        create: typeof createMock
      }
    }) => Promise<unknown>) =>
      fn({
        publicFormAnswer: {
          deleteMany: deleteManyMock,
          upsert: upsertMock,
          create: createMock,
        },
      }),
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

function foreignKeyError() {
  return new Prisma.PrismaClientKnownRequestError("foreign key constraint failed", {
    code: "P2003",
    clientVersion: "test",
    meta: { constraint: "corretor_studio_public_form_answers_questionId_fkey" },
  })
}

describe("PublicFormsRepository.persistSubmissionAnswers P2003", () => {
  beforeEach(() => {
    deleteManyMock.mockClear()
    upsertMock.mockClear()
    createMock.mockClear()
    upsertMock.mockImplementation(async () => ({}))
    createMock.mockImplementation(async () => ({}))
  })

  it("em FK obsoleta de questionId, grava a resposta com questionId null preservando o snapshot", async () => {
    upsertMock.mockImplementationOnce(async () => {
      throw foreignKeyError()
    })

    const repo = new PublicFormsRepository()
    const questionSnapshot = { id: "stale-q", title: "Pergunta antiga" }

    await repo.persistSubmissionAnswers("sub-1", [
      {
        questionId: "stale-q",
        value: "ok" as Prisma.InputJsonValue,
        questionSnapshot,
      },
    ])

    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)
    const createArg = createMock.mock.calls[0] as unknown as [
      { data: { questionId: string | null; questionSnapshot: unknown } },
    ]
    expect(createArg[0].data.questionId).toBeNull()
    expect(createArg[0].data.questionSnapshot).toEqual(questionSnapshot)
  })
})
