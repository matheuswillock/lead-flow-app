import { beforeEach, describe, expect, it, mock } from "bun:test"

const findManyMock = mock(async () => [] as Array<{
  id: string
  version: number
  snapshot: unknown
}>)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicFormPublication: {
      findMany: findManyMock,
    },
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

const CURRENT = {
  id: "pub-2",
  version: 2,
  snapshot: { questions: [{ id: "q-new" }] },
}
const PREVIOUS = {
  id: "pub-1",
  version: 1,
  snapshot: { questions: [{ id: "q-old" }, { id: "q-shared" }] },
}

describe("PublicFormsRepository.findPublicationContainingQuestion(s)", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    findManyMock.mockResolvedValue([CURRENT, PREVIOUS])
  })

  it("retorna a publicação mais nova cujo snapshot contém o questionId", async () => {
    const repo = new PublicFormsRepository()

    const previous = await repo.findPublicationContainingQuestion("form-1", "q-old")
    expect(previous).toEqual({
      publicationId: "pub-1",
      version: 1,
      snapshot: PREVIOUS.snapshot,
    })

    const current = await repo.findPublicationContainingQuestion("form-1", "q-new")
    expect(current?.publicationId).toBe("pub-2")
  })

  it("retorna null quando nenhuma publicação contém o id", async () => {
    const repo = new PublicFormsRepository()
    const result = await repo.findPublicationContainingQuestion("form-1", "q-missing")
    expect(result).toBeNull()
  })

  it("findPublicationContainingQuestions prefere a mais nova que cobre o conjunto", async () => {
    const repo = new PublicFormsRepository()
    const coveringCurrent = await repo.findPublicationContainingQuestions("form-1", ["q-new"])
    expect(coveringCurrent?.publicationId).toBe("pub-2")

    const coveringPrevious = await repo.findPublicationContainingQuestions("form-1", [
      "q-old",
      "q-shared",
    ])
    expect(coveringPrevious?.publicationId).toBe("pub-1")

    const none = await repo.findPublicationContainingQuestions("form-1", ["q-old", "q-new"])
    expect(none).toBeNull()
  })
})
