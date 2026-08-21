import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const findFirstMock = mock(async () => null as { id: string; leadId: string | null } | null)
const createMock = mock(async () => ({ id: "sub-new" }))
const findUniqueMock = mock(async () => null as { id: string; leadId: string | null } | null)
const findUniqueOrThrowMock = mock(async () => ({ id: "sub-winner" }))
const updateMock = mock(async () => ({}))
const deleteManyMock = mock(async () => ({ count: 0 }))
const answerFindUniqueMock = mock(async () => null as { value: Prisma.JsonValue } | null)
const answerUpsertMock = mock(async () => ({}))
const executeRawMock = mock(async () => 0)
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
        findUnique: typeof answerFindUniqueMock
        upsert: typeof answerUpsertMock
      }
      $executeRaw: typeof executeRawMock
      $executeRawUnsafe: typeof executeRawUnsafeMock
    }) => Promise<unknown>) =>
      fn({
        publicFormSubmission: { update: updateMock },
        publicFormAnswer: {
          deleteMany: deleteManyMock,
          findUnique: answerFindUniqueMock,
          upsert: answerUpsertMock,
        },
        $executeRaw: executeRawMock,
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
    answerFindUniqueMock.mockReset()
    answerUpsertMock.mockReset()
    executeRawMock.mockReset()
    executeRawUnsafeMock.mockReset()
    findFirstMock.mockResolvedValue(null)
    createMock.mockResolvedValue({ id: "sub-new" })
    findUniqueMock.mockResolvedValue(null)
    findUniqueOrThrowMock.mockResolvedValue({ id: "sub-winner" })
    updateMock.mockResolvedValue({})
    deleteManyMock.mockResolvedValue({ count: 0 })
    answerFindUniqueMock.mockResolvedValue(null)
    answerUpsertMock.mockResolvedValue({})
    executeRawMock.mockResolvedValue(0)
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
    expect(deleteManyMock).not.toHaveBeenCalled()
  })

  it("progresso existente faz merge — não apaga respostas ausentes do payload", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "sub-existing", leadId: "lead-1" })
    findUniqueOrThrowMock.mockResolvedValueOnce({ id: "sub-existing" })

    const repo = new PublicFormsRepository()
    await repo.upsertProgressSubmission(BASE_DATA)

    expect(deleteManyMock).not.toHaveBeenCalled()
    expect(answerUpsertMock).toHaveBeenCalledTimes(1)
    expect(executeRawMock).toHaveBeenCalled()
  })

  it("criação de progresso também faz merge — não apaga respostas de outro payload concorrente", async () => {
    const repo = new PublicFormsRepository()
    const result = await repo.upsertProgressSubmission(BASE_DATA)

    expect(result.id).toBe("sub-new")
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(deleteManyMock).not.toHaveBeenCalled()
    expect(answerUpsertMock).toHaveBeenCalledTimes(1)
    expect(executeRawMock).toHaveBeenCalled()
  })

  it("não sobrescreve resposta preenchida com blur vazio stale", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "sub-existing", leadId: "lead-1" })
    findUniqueOrThrowMock.mockResolvedValueOnce({ id: "sub-existing" })
    answerFindUniqueMock.mockResolvedValueOnce({ value: "Ana" })

    const repo = new PublicFormsRepository()
    await repo.upsertProgressSubmission({
      ...BASE_DATA,
      answers: [
        {
          questionId: "q-1",
          value: "" as Prisma.InputJsonValue,
          questionSnapshot: { id: "q-1" } as Prisma.InputJsonValue,
        },
      ],
    })

    expect(answerUpsertMock).not.toHaveBeenCalled()
  })

  it("retry atrasado não sobrescreve resposta mais nova", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "sub-existing", leadId: "lead-1" })
    findUniqueOrThrowMock.mockResolvedValueOnce({ id: "sub-existing" })
    answerFindUniqueMock.mockResolvedValueOnce({
      answeredAt: new Date("2026-08-21T10:05:00.000Z"),
      sourceEventId: "8b9e6f52-2f68-4f5f-9f9a-c5a4f3f5d002",
    } as never)

    const repo = new PublicFormsRepository()
    await repo.upsertProgressSubmission({
      ...BASE_DATA,
      answers: [
        {
          questionId: "q-1",
          value: "Valor antigo" as Prisma.InputJsonValue,
          questionSnapshot: { id: "q-1" } as Prisma.InputJsonValue,
          answeredAt: new Date("2026-08-21T10:00:00.000Z"),
          sourceEventId: "1a2b3c4d-1111-4aaa-bbbb-c5a4f3f5d001",
        },
      ],
    })

    expect(answerUpsertMock).not.toHaveBeenCalled()
  })

  it("resposta mais nova sobrescreve e grava o envelope causal", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "sub-existing", leadId: "lead-1" })
    findUniqueOrThrowMock.mockResolvedValueOnce({ id: "sub-existing" })
    answerFindUniqueMock.mockResolvedValueOnce({
      answeredAt: new Date("2026-08-21T10:00:00.000Z"),
      sourceEventId: "1a2b3c4d-1111-4aaa-bbbb-c5a4f3f5d001",
    } as never)

    const answeredAt = new Date("2026-08-21T10:05:00.000Z")
    const repo = new PublicFormsRepository()
    await repo.upsertProgressSubmission({
      ...BASE_DATA,
      answers: [
        {
          questionId: "q-1",
          value: "Valor novo" as Prisma.InputJsonValue,
          questionSnapshot: { id: "q-1" } as Prisma.InputJsonValue,
          answeredAt,
          sourceEventId: "8b9e6f52-2f68-4f5f-9f9a-c5a4f3f5d002",
          mappingKey: "name",
        },
      ],
    })

    expect(answerUpsertMock).toHaveBeenCalledTimes(1)
    expect(answerUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          answeredAt,
          sourceEventId: "8b9e6f52-2f68-4f5f-9f9a-c5a4f3f5d002",
          mappingKey: "name",
        }),
      }),
    )
  })

  it("P2002 sem vencedor visível: relança o erro", async () => {
    createMock.mockRejectedValueOnce(uniqueRequestKeyError())
    findUniqueMock.mockResolvedValueOnce(null)

    const repo = new PublicFormsRepository()
    await expect(repo.upsertProgressSubmission(BASE_DATA)).rejects.toMatchObject({ code: "P2002" })
  })
})
