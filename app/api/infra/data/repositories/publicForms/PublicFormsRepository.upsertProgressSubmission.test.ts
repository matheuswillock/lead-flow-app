import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const findFirstMock = mock(async () => null as { id: string; leadId: string | null } | null)
const createMock = mock(async () => ({ id: "sub-new" }))
const findUniqueMock = mock(async () => null as { id: string; leadId: string | null } | null)
const findUniqueOrThrowMock = mock(async () => ({ id: "sub-winner" }))
const updateMock = mock(async () => ({}))
const deleteManyMock = mock(async () => ({ count: 0 }))
const answerUpsertMock = mock(async () => ({}))
const executeRawUnsafeMock = mock(async () => 0)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicFormSubmission: {
      findFirst: findFirstMock,
      create: createMock,
      findUnique: findUniqueMock,
      findUniqueOrThrow: findUniqueOrThrowMock,
      update: updateMock,
    },
    $transaction: async (fn: (tx: {
      publicFormSubmission: { update: typeof updateMock }
      publicFormAnswer: {
        deleteMany: typeof deleteManyMock
        upsert: typeof answerUpsertMock
      }
      $executeRawUnsafe: typeof executeRawUnsafeMock
    }) => Promise<unknown>) =>
      fn({
        publicFormSubmission: { update: updateMock },
        publicFormAnswer: {
          deleteMany: deleteManyMock,
          upsert: answerUpsertMock,
        },
        $executeRawUnsafe: executeRawUnsafeMock,
      }),
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

function uniqueRequestKeyError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["requestKey"] },
  })
}

const BASE_DATA = {
  formId: "form-1",
  publicationId: "pub-1",
  visitorSessionId: "session_abcdefghij",
  requestKey: "progress:session_abcdefghij:pub-1",
  origin: {} as Prisma.InputJsonValue,
  completionStatus: "partial" as const,
  leadId: "lead-1",
  answers: [
    {
      questionId: "q-1",
      value: "Ana" as Prisma.InputJsonValue,
      questionSnapshot: { id: "q-1" } as Prisma.InputJsonValue,
    },
  ],
}

describe("PublicFormsRepository.upsertProgressSubmission P2002", () => {
  beforeEach(() => {
    findFirstMock.mockReset()
    createMock.mockReset()
    findUniqueMock.mockReset()
    findUniqueOrThrowMock.mockReset()
    updateMock.mockReset()
    deleteManyMock.mockReset()
    answerUpsertMock.mockReset()
    executeRawUnsafeMock.mockReset()
    findFirstMock.mockResolvedValue(null)
    createMock.mockResolvedValue({ id: "sub-new" })
    findUniqueMock.mockResolvedValue(null)
    findUniqueOrThrowMock.mockResolvedValue({ id: "sub-winner" })
    updateMock.mockResolvedValue({})
    deleteManyMock.mockResolvedValue({ count: 0 })
    answerUpsertMock.mockResolvedValue({})
    executeRawUnsafeMock.mockResolvedValue(0)
  })

  it("em corrida de requestKey, reusa o vencedor e persiste as respostas", async () => {
    createMock.mockRejectedValueOnce(uniqueRequestKeyError())
    findUniqueMock.mockResolvedValueOnce({ id: "sub-winner", leadId: null })

    const repo = new PublicFormsRepository()
    const result = await repo.upsertProgressSubmission(BASE_DATA)

    expect(result.id).toBe("sub-winner")
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { requestKey: BASE_DATA.requestKey } })
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(answerUpsertMock).toHaveBeenCalledTimes(1)
  })

  it("P2002 sem vencedor visível: relança o erro", async () => {
    createMock.mockRejectedValueOnce(uniqueRequestKeyError())
    findUniqueMock.mockResolvedValueOnce(null)

    const repo = new PublicFormsRepository()
    await expect(repo.upsertProgressSubmission(BASE_DATA)).rejects.toMatchObject({ code: "P2002" })
  })
})
