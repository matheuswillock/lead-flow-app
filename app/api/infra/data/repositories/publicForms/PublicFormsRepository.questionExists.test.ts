import { beforeEach, describe, expect, it, mock } from "bun:test"

const findUniqueMock = mock(async (_args: { where: { id: string } }) => null as { id: string } | null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicFormQuestion: {
      findUnique: findUniqueMock,
    },
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

describe("PublicFormsRepository.questionExists", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
  })

  it("retorna true quando a pergunta existe na tabela viva", async () => {
    findUniqueMock.mockResolvedValueOnce({ id: "question-1" })
    const repo = new PublicFormsRepository()

    const exists = await repo.questionExists("question-1")

    expect(exists).toBe(true)
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "question-1" },
      select: { id: true },
    })
  })

  it("retorna false quando a pergunta não existe (apagada/substituída)", async () => {
    findUniqueMock.mockResolvedValueOnce(null)
    const repo = new PublicFormsRepository()

    const exists = await repo.questionExists("stale-question")

    expect(exists).toBe(false)
  })
})
