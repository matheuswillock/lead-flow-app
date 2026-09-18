import { beforeEach, describe, expect, it, mock } from "bun:test"

type FindManyArgs = {
  where?: { status?: { in?: string[] } }
  orderBy?: unknown
  take?: number
}

const findManyMock = mock(async (_args: FindManyArgs) => [] as Array<Record<string, unknown>>)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    teamFormDomain: {
      findMany: findManyMock,
    },
  },
}))

const { TeamFormDomainRepository } = await import("./TeamFormDomainRepository")

describe("TeamFormDomainRepository.listForReconciliation", () => {
  beforeEach(() => {
    findManyMock.mockClear()
  })

  /**
   * Regressão do achado P1 do codex: a varredura só olhava `pending`/`failed`,
   * então um domínio `verified` cujo CNAME sumisse ficava verificado para
   * sempre e as campanhas seguiam gerando links para um host morto.
   */
  it("inclui domínios verificados para permitir rebaixamento", async () => {
    await new TeamFormDomainRepository().listForReconciliation(50)

    const args = findManyMock.mock.calls[0]?.[0] as FindManyArgs | undefined
    expect(args?.where?.status?.in).toContain("verified")
  })

  it("mantém pending e failed na varredura", async () => {
    await new TeamFormDomainRepository().listForReconciliation(50)

    const args = findManyMock.mock.calls[0]?.[0] as FindManyArgs | undefined
    expect(args?.where?.status?.in).toEqual(
      expect.arrayContaining(["pending", "failed", "verified"]),
    )
  })

  it("respeita o limite do lote", async () => {
    await new TeamFormDomainRepository().listForReconciliation(7)

    const args = findManyMock.mock.calls[0]?.[0] as FindManyArgs | undefined
    expect(args?.take).toBe(7)
  })
})
