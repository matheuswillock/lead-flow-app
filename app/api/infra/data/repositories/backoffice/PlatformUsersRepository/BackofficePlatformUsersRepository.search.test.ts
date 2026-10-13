import { beforeEach, describe, expect, it, mock } from "bun:test"

const findManyMock = mock(async () => [] as unknown[])
const countMock = mock(async () => 0)
const memberFindManyMock = mock(async () => [] as unknown[])

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: {
      findMany: findManyMock,
      count: countMock,
    },
    teamMember: {
      findMany: memberFindManyMock,
    },
  },
}))

const { BackofficePlatformUsersRepository } = await import("./BackofficePlatformUsersRepository")

beforeEach(() => {
  findManyMock.mockClear()
  countMock.mockClear()
  memberFindManyMock.mockClear()
})

describe("BackofficePlatformUsersRepository — busca por nome de time", () => {
  it("inclui o nome do time na busca unificada usada pelo filtro q", async () => {
    await new BackofficePlatformUsersRepository().findMasterUsersWithFilters(
      { name: "tri saúde", email: "tri saúde", team: "tri saúde" },
      { page: 1, pageSize: 10 },
    )

    const calls = findManyMock.mock.calls as unknown as Array<[
      { where?: Record<string, unknown> } | undefined,
    ]>
    const where = calls[0]?.[0]?.where as Record<string, unknown>
    const searchClause = (where.AND as Array<Record<string, unknown>>)[0]
    const searchAlternatives = searchClause.OR as Array<Record<string, unknown>>

    expect(searchAlternatives).toContainEqual({
      teamsOwned: {
        some: { name: { contains: "tri saúde", mode: "insensitive" } },
      },
    })
  })
})
