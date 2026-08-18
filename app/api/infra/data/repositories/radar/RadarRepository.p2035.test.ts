import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { RadarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

const POSTGRES_BIND_LIMIT = 32_767
const IN_CHUNK = 5_000
const EMAIL_COUNT = 32_768
const TEAM_ID = "90bb1d12-5855-4f3e-aecb-e92f597e650c"

function makeEmails(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `user${index}@example.com`)
}

function makeLeadIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const hex = (index + 1).toString(16).padStart(12, "0")
    return `00000000-0000-4000-8000-${hex}`
  })
}

function inValuesFromArgs(args: unknown): unknown[] {
  const where = (args as { where?: Record<string, unknown> } | undefined)?.where
  if (!where) return []
  for (const value of Object.values(where)) {
    if (value && typeof value === "object" && "in" in (value as object)) {
      const list = (value as { in?: unknown }).in
      if (Array.isArray(list)) return list
    }
  }
  return []
}

function assertPostgresBindLimit(inList: unknown[]) {
  const bindCount = 1 + inList.length
  if (bindCount > POSTGRES_BIND_LIMIT) {
    throw new Prisma.PrismaClientKnownRequestError(
      `too many bind variables in prepared statement, expected maximum of ${POSTGRES_BIND_LIMIT}, received ${bindCount}`,
      { code: "P2035", clientVersion: "test" }
    )
  }
}

function expectChunkedInCalls(
  findMany: ReturnType<typeof mock>,
  total: number
) {
  const expectedCalls = Math.ceil(total / IN_CHUNK)
  expect(findMany).toHaveBeenCalledTimes(expectedCalls)

  const inLengths = findMany.mock.calls.map((call) => inValuesFromArgs(call[0]).length)
  expect(inLengths.every((length) => length > 0 && length <= IN_CHUNK)).toBe(true)
  expect(Math.max(...inLengths)).toBeLessThanOrEqual(IN_CHUNK)
  expect(inLengths.reduce((sum, length) => sum + length, 0)).toBe(total)
}

describe("RadarRepository P2035 IN chunk", () => {
  const radarProfileFindMany = mock(async (args: unknown) => {
    const emails = inValuesFromArgs(args)
    assertPostgresBindLimit(emails)
    return emails.map((email) => ({
      normalizedPrimaryEmail: String(email),
      displayName: "Nome",
      displayPhone: null,
      primaryEmail: String(email),
      primaryDocument: null,
      lastSeenAt: null,
      consents: [],
      sourceLinks: [],
      identities: [],
      profileData: { extra: "cache" },
    }))
  })

  const leadFindMany = mock(async (args: unknown) => {
    const ids = inValuesFromArgs(args)
    assertPostgresBindLimit(ids)
    return ids.map((id) => ({
      id: String(id),
      status: "new",
      currentHealthPlan: null,
      soldPlan: null,
      contractDueDate: null,
      referenceHospital: null,
    }))
  })

  const prismaMock = {
    radarProfile: { findMany: radarProfileFindMany },
    lead: { findMany: leadFindMany },
  } as unknown as PrismaClient

  let repo: RadarRepository

  beforeEach(() => {
    radarProfileFindMany.mockClear()
    leadFindMany.mockClear()
    repo = new RadarRepository(prismaMock)
  })

  it("findProfileDataByEmails com 32_768 e-mails não estoura bind e chunka IN em <= 5000", async () => {
    const emails = makeEmails(EMAIL_COUNT)
    const map = await repo.findProfileDataByEmails(TEAM_ID, emails)

    expect(map.size).toBe(EMAIL_COUNT)
    expect(map.get("user0@example.com")).toEqual({ extra: "cache" })
    expectChunkedInCalls(radarProfileFindMany, EMAIL_COUNT)
    expect(leadFindMany).not.toHaveBeenCalled()
  })

  it("findProfilesForInterpolationByEmails com 32_768 e-mails não estoura bind e chunka IN em <= 5000", async () => {
    const emails = makeEmails(EMAIL_COUNT)
    const profiles = await repo.findProfilesForInterpolationByEmails(TEAM_ID, emails)

    expect(profiles).toHaveLength(EMAIL_COUNT)
    expect(profiles[0]?.normalizedPrimaryEmail).toBe("user0@example.com")
    expectChunkedInCalls(radarProfileFindMany, EMAIL_COUNT)
    expect(leadFindMany).not.toHaveBeenCalled()
  })

  it("findLeadsForRadarFieldResolution com 32_768 ids não estoura bind e chunka IN em <= 5000", async () => {
    const leadIds = makeLeadIds(EMAIL_COUNT)
    const leads = await repo.findLeadsForRadarFieldResolution(TEAM_ID, leadIds)

    expect(leads.size).toBe(EMAIL_COUNT)
    expect(leads.get(leadIds[0])?.id).toBe(leadIds[0])
    expectChunkedInCalls(leadFindMany, EMAIL_COUNT)
    expect(radarProfileFindMany).not.toHaveBeenCalled()
  })

  it("listProfilesForSegmentationByIds com 32_768 ids não estoura bind e chunka IN em <= 5000", async () => {
    const profileIds = makeLeadIds(EMAIL_COUNT)
    const profiles = await repo.listProfilesForSegmentationByIds(TEAM_ID, profileIds)

    expect(profiles).toHaveLength(EMAIL_COUNT)
    expectChunkedInCalls(radarProfileFindMany, EMAIL_COUNT)
    expect(leadFindMany).not.toHaveBeenCalled()
  })

  it("lista vazia não chama findMany", async () => {
    await expect(repo.findProfileDataByEmails(TEAM_ID, [])).resolves.toEqual(new Map())
    await expect(repo.findProfilesForInterpolationByEmails(TEAM_ID, [])).resolves.toEqual([])
    await expect(repo.findLeadsForRadarFieldResolution(TEAM_ID, [])).resolves.toEqual(new Map())
    await expect(repo.listProfilesForSegmentationByIds(TEAM_ID, [])).resolves.toEqual([])
    expect(radarProfileFindMany).not.toHaveBeenCalled()
    expect(leadFindMany).not.toHaveBeenCalled()
  })
})
