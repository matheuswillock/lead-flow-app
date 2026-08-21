import { beforeEach, describe, expect, it, mock } from "bun:test"
import { createEmptyPublicFormDraft } from "@/lib/public-forms/empty-draft"

const KEPT_ID = "11111111-1111-4111-8111-111111111111"
const REMOVED_ID = "22222222-2222-4222-8222-222222222222"
const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const questionDeleteManyMock = mock(async () => ({ count: 0 }))
const questionFindManyMock = mock(
  async (_args: { where: { formId: string; deletedAt?: Date | null; id?: { notIn: string[] } } }) =>
    [] as Array<{ id: string }>,
)
const questionAggregateMock = mock(async () => ({ _max: { position: null as number | null } }))
const questionUpdateMock = mock(async () => ({}))
const questionUpsertMock = mock(async () => ({}))
const optionDeleteManyMock = mock(async () => ({ count: 0 }))
const optionCreateManyMock = mock(async () => ({ count: 0 }))
const ruleDeleteManyMock = mock(async () => ({ count: 0 }))
const scoreBandDeleteManyMock = mock(async () => ({ count: 0 }))
const eligibleCloserDeleteManyMock = mock(async () => ({ count: 0 }))
const formUpdateMock = mock(async () => ({}))
const formFindUniqueOrThrowMock = mock(async () => ({ id: FORM_ID, questions: [] }))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (
      fn: (tx: {
        publicForm: {
          update: typeof formUpdateMock
          findUniqueOrThrow: typeof formFindUniqueOrThrowMock
        }
        publicFormRule: { deleteMany: typeof ruleDeleteManyMock }
        publicFormScoreBand: { deleteMany: typeof scoreBandDeleteManyMock }
        publicFormEligibleCloser: { deleteMany: typeof eligibleCloserDeleteManyMock }
        publicFormQuestion: {
          deleteMany: typeof questionDeleteManyMock
          findMany: typeof questionFindManyMock
          aggregate: typeof questionAggregateMock
          update: typeof questionUpdateMock
          upsert: typeof questionUpsertMock
        }
        publicFormOption: {
          deleteMany: typeof optionDeleteManyMock
          createMany: typeof optionCreateManyMock
        }
      }) => Promise<unknown>,
    ) =>
      fn({
        publicForm: {
          update: formUpdateMock,
          findUniqueOrThrow: formFindUniqueOrThrowMock,
        },
        publicFormRule: { deleteMany: ruleDeleteManyMock },
        publicFormScoreBand: { deleteMany: scoreBandDeleteManyMock },
        publicFormEligibleCloser: { deleteMany: eligibleCloserDeleteManyMock },
        publicFormQuestion: {
          deleteMany: questionDeleteManyMock,
          findMany: questionFindManyMock,
          aggregate: questionAggregateMock,
          update: questionUpdateMock,
          upsert: questionUpsertMock,
        },
        publicFormOption: {
          deleteMany: optionDeleteManyMock,
          createMany: optionCreateManyMock,
        },
      }),
  },
}))

const { PublicFormsRepository, nextSoftDeletedQuestionPosition, SOFT_DELETED_QUESTION_POSITION_BASE } =
  await import("./PublicFormsRepository")

function draftWithKeptQuestion() {
  const draft = createEmptyPublicFormDraft()
  return {
    ...draft,
    name: "Lista Fria",
    questions: [
      {
        id: KEPT_ID,
        type: "text" as const,
        title: "Nome",
        required: true,
        scoreWeight: 0,
        options: [],
      },
    ],
  }
}

describe("nextSoftDeletedQuestionPosition", () => {
  it("começa na faixa de tombstone quando ainda não há perguntas apagadas", () => {
    expect(nextSoftDeletedQuestionPosition(null)).toBe(SOFT_DELETED_QUESTION_POSITION_BASE)
  })

  it("continua depois da maior position já tombstoned", () => {
    expect(nextSoftDeletedQuestionPosition(SOFT_DELETED_QUESTION_POSITION_BASE + 4)).toBe(
      SOFT_DELETED_QUESTION_POSITION_BASE + 5,
    )
  })
})

describe("PublicFormsRepository.updateWithDraft soft-delete", () => {
  beforeEach(() => {
    questionDeleteManyMock.mockClear()
    questionFindManyMock.mockClear()
    questionAggregateMock.mockClear()
    questionUpdateMock.mockClear()
    questionUpsertMock.mockClear()
    optionDeleteManyMock.mockClear()
    optionCreateManyMock.mockClear()
    ruleDeleteManyMock.mockClear()
    scoreBandDeleteManyMock.mockClear()
    eligibleCloserDeleteManyMock.mockClear()
    formUpdateMock.mockClear()
    formFindUniqueOrThrowMock.mockClear()
    questionAggregateMock.mockImplementation(async () => ({ _max: { position: null } }))
    questionFindManyMock.mockImplementation(async () => [])
    questionUpdateMock.mockImplementation(async () => ({}))
    questionUpsertMock.mockImplementation(async () => ({}))
  })

  it("não faz hard-delete da pergunta ausente no draft; grava deletedAt e libera a position", async () => {
    let findManyCalls = 0
    questionFindManyMock.mockImplementation(async () => {
      findManyCalls += 1
      if (findManyCalls === 1) return [{ id: REMOVED_ID }]
      return [{ id: KEPT_ID }]
    })

    const repo = new PublicFormsRepository()
    await repo.updateWithDraft(FORM_ID, draftWithKeptQuestion())

    expect(questionDeleteManyMock).not.toHaveBeenCalled()
    expect(questionAggregateMock).toHaveBeenCalledTimes(1)
    expect(questionUpdateMock.mock.calls.length).toBeGreaterThanOrEqual(1)

    const firstUpdate = questionUpdateMock.mock.calls[0] as unknown as [
      { where: { id: string }; data: { deletedAt: Date; position: number } },
    ]
    expect(firstUpdate[0].where.id).toBe(REMOVED_ID)
    expect(firstUpdate[0].data.deletedAt).toBeInstanceOf(Date)
    expect(firstUpdate[0].data.position).toBe(SOFT_DELETED_QUESTION_POSITION_BASE)

    const upsertArg = questionUpsertMock.mock.calls[0] as unknown as [
      { update: { deletedAt: Date | null; position: number } },
    ]
    expect(upsertArg[0].update.deletedAt).toBeNull()
    expect(upsertArg[0].update.position).toBe(0)
  })

  it("reusa a mesma linha (deletedAt null) se o draft devolver um id já soft-deleted", async () => {
    questionFindManyMock.mockImplementation(async () => [])

    const repo = new PublicFormsRepository()
    await repo.updateWithDraft(FORM_ID, draftWithKeptQuestion())

    expect(questionDeleteManyMock).not.toHaveBeenCalled()
    expect(questionUpsertMock).toHaveBeenCalledTimes(1)
    const upsertArg = questionUpsertMock.mock.calls[0] as unknown as [
      { where: { id: string }; update: { deletedAt: Date | null } },
    ]
    expect(upsertArg[0].where.id).toBe(KEPT_ID)
    expect(upsertArg[0].update.deletedAt).toBeNull()
  })
})
