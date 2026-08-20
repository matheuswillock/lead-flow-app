import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const deleteManyMock = mock(async () => ({ count: 0 }))
const upsertMock = mock(async () => ({}))
const createMock = mock(async () => ({}))
const findManyMock = mock(async () => [] as Array<{ id: string; questionSnapshot: unknown }>)
const updateMock = mock(async () => ({}))
const executeRawUnsafeMock = mock(async () => 0)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: {
      publicFormAnswer: {
        deleteMany: typeof deleteManyMock
        upsert: typeof upsertMock
        create: typeof createMock
        findMany: typeof findManyMock
        update: typeof updateMock
      }
      $executeRawUnsafe: typeof executeRawUnsafeMock
    }) => Promise<unknown>) =>
      fn({
        publicFormAnswer: {
          deleteMany: deleteManyMock,
          upsert: upsertMock,
          create: createMock,
          findMany: findManyMock,
          update: updateMock,
        },
        $executeRawUnsafe: executeRawUnsafeMock,
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
    findManyMock.mockClear()
    updateMock.mockClear()
    executeRawUnsafeMock.mockClear()
    upsertMock.mockImplementation(async () => ({}))
    createMock.mockImplementation(async () => ({}))
    findManyMock.mockImplementation(async () => [])
    updateMock.mockImplementation(async () => ({}))
    executeRawUnsafeMock.mockImplementation(async () => 0)
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

  it("apaga respostas com questionId null antes de gravar, para o fallback P2003 não acumular duplicatas", async () => {
    upsertMock.mockImplementationOnce(async () => {
      throw foreignKeyError()
    })

    const repo = new PublicFormsRepository()
    await repo.persistSubmissionAnswers("sub-1", [
      {
        questionId: "stale-q",
        value: "ok" as Prisma.InputJsonValue,
        questionSnapshot: { id: "stale-q" },
      },
    ])

    expect(deleteManyMock).toHaveBeenCalledTimes(1)
    const deleteArg = deleteManyMock.mock.calls[0] as unknown as [
      {
        where: {
          submissionId: string
          OR: Array<{ questionId: unknown }>
        }
      },
    ]
    expect(deleteArg[0].where.submissionId).toBe("sub-1")
    expect(deleteArg[0].where.OR).toEqual([
      { questionId: { notIn: ["stale-q"] } },
      { questionId: null },
    ])
  })

  it("no fallback P2003, atualiza a resposta null existente da mesma pergunta em vez de criar outra", async () => {
    upsertMock.mockImplementationOnce(async () => {
      throw foreignKeyError()
    })
    findManyMock.mockImplementation(async () => [
      { id: "answer-null-1", questionSnapshot: { id: "stale-q", title: "Antiga" } },
    ])

    const repo = new PublicFormsRepository()
    await repo.persistSubmissionAnswers("sub-1", [
      {
        questionId: "stale-q",
        value: "nova" as Prisma.InputJsonValue,
        questionSnapshot: { id: "stale-q", title: "Antiga" },
      },
    ])

    expect(createMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledTimes(1)
    const updateArg = updateMock.mock.calls[0] as unknown as [
      { where: { id: string }; data: { value: unknown } },
    ]
    expect(updateArg[0].where.id).toBe("answer-null-1")
    expect(updateArg[0].data.value).toBe("nova")
  })

  it("envolve o upsert em SAVEPOINT para o fallback P2003 não abortar a transação (25P02)", async () => {
    upsertMock.mockImplementationOnce(async () => {
      throw foreignKeyError()
    })

    const repo = new PublicFormsRepository()
    await repo.persistSubmissionAnswers("sub-1", [
      {
        questionId: "stale-q",
        value: "ok" as Prisma.InputJsonValue,
        questionSnapshot: { id: "stale-q" },
      },
    ])

    const sql = executeRawUnsafeMock.mock.calls.map((call) =>
      String((call as unknown as [string])[0]),
    )
    expect(sql).toContain("SAVEPOINT persist_answer_fk")
    expect(sql).toContain("ROLLBACK TO SAVEPOINT persist_answer_fk")
    expect(sql).toContain("SAVEPOINT persist_answer_without_fk")
    expect(sql).toContain("RELEASE SAVEPOINT persist_answer_without_fk")
    expect(createMock).toHaveBeenCalledTimes(1)
  })
})
