import { beforeEach, describe, expect, it, mock } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import type { Prisma } from "@prisma/client"
import type { RadarSegmentRules } from "@/lib/radar/segment-dsl"

const countProfilesByEmailContactListIds = mock(async (_teamId: string, _listIds: string[]) => 0)
const listProfileIdsByEmailContactListIds = mock(
  async (_teamId: string, _listIds: string[], _pagination?: { skip: number; take: number }) =>
    [] as string[]
)
const countProfilesByEmailContactListIntersection = mock(
  async (_teamId: string, _listIdGroups: string[][]) => 0
)
const listProfileIdsByEmailContactListIntersection = mock(
  async (
    _teamId: string,
    _listIdGroups: string[][],
    _pagination?: { skip: number; take: number }
  ) => [] as string[]
)
const countProfilesByWhere = mock(async (_where: Prisma.RadarProfileWhereInput) => 0)
const listProfileIdsByWhere = mock(
  async (_where: Prisma.RadarProfileWhereInput, _pagination?: { skip: number; take: number }) =>
    [] as string[]
)
const findProfileIdsByEmailContactListIds = mock(
  async (_teamId: string, _listIds: string[]) => [] as string[]
)
const findEmailContactIdsByCustomField = mock(
  async (
    _teamId: string,
    _fieldKey: string,
    _operator: "eq" | "neq" | "contains" | "is_empty" | "not_empty",
    _value: unknown
  ) => [] as string[]
)
type AnyFilterOptions = {
  combine: "intersect" | "union"
  listIdGroups?: string[][]
  emailContactIdGroups?: string[][]
}
const countProfilesByWhereWithAnyFilters = mock(
  async (
    _teamId: string,
    _where: Prisma.RadarProfileWhereInput | null,
    _options: AnyFilterOptions
  ) => 0
)
const listProfileIdsByWhereWithAnyFilters = mock(
  async (
    _teamId: string,
    _where: Prisma.RadarProfileWhereInput | null,
    _options: AnyFilterOptions,
    _pagination?: { skip: number; take: number }
  ) => [] as string[]
)

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    countProfilesByEmailContactListIds,
    listProfileIdsByEmailContactListIds,
    countProfilesByEmailContactListIntersection,
    listProfileIdsByEmailContactListIntersection,
    countProfilesByWhere,
    listProfileIdsByWhere,
    findProfileIdsByEmailContactListIds,
    findEmailContactIdsByCustomField,
    countProfilesByWhereWithAnyFilters,
    listProfileIdsByWhereWithAnyFilters,
  },
}))

const { radarSegmentQueryService } = await import("./RadarSegmentQueryService")

const TEAM_ID = "11111111-1111-4111-8111-111111111111"
const LIST_A = "22222222-2222-4222-8222-222222222222"
const LIST_B = "33333333-3333-4333-8333-333333333333"
const SCOPE = {
  teamId: TEAM_ID,
  ctx: { profileId: "operator-1", teamMember: { role: "manager", functions: [] } },
}

const PROFILE_ID_IN_CHUNK = 5_000
const HUGE_CONTACT_COUNT = 33_000

function makeHugeContactIds(count = HUGE_CONTACT_COUNT): string[] {
  return Array.from({ length: count }, (_, index) => {
    const hex = (index + 1).toString(16).padStart(12, "0")
    return `00000000-0000-4000-8000-${hex}`
  })
}

function whereHasOrOfInChunks(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  if (Array.isArray(value)) return value.some(whereHasOrOfInChunks)

  const record = value as Record<string, unknown>
  if (Array.isArray(record.OR)) {
    const inChunks = record.OR.filter((item) => {
      if (!item || typeof item !== "object") return false
      const ids = (item as { id?: { in?: unknown } }).id?.in
      return Array.isArray(ids) && ids.length === PROFILE_ID_IN_CHUNK
    })
    if (inChunks.length >= 2) return true
  }

  return Object.values(record).some(whereHasOrOfInChunks)
}

describe("RadarSegmentQueryService P2035 (JOIN/ANY)", () => {
  beforeEach(() => {
    countProfilesByEmailContactListIds.mockReset()
    listProfileIdsByEmailContactListIds.mockReset()
    countProfilesByEmailContactListIntersection.mockReset()
    listProfileIdsByEmailContactListIntersection.mockReset()
    countProfilesByWhere.mockReset()
    listProfileIdsByWhere.mockReset()
    findProfileIdsByEmailContactListIds.mockReset()
    findEmailContactIdsByCustomField.mockReset()
    countProfilesByWhereWithAnyFilters.mockReset()
    listProfileIdsByWhereWithAnyFilters.mockReset()

    countProfilesByEmailContactListIds.mockResolvedValue(0)
    listProfileIdsByEmailContactListIds.mockResolvedValue([])
    countProfilesByEmailContactListIntersection.mockResolvedValue(12)
    listProfileIdsByEmailContactListIntersection.mockResolvedValue(["profile-a"])
    countProfilesByWhere.mockResolvedValue(0)
    listProfileIdsByWhere.mockResolvedValue([])
    findProfileIdsByEmailContactListIds.mockResolvedValue([])
    findEmailContactIdsByCustomField.mockResolvedValue([])
    countProfilesByWhereWithAnyFilters.mockResolvedValue(7)
    listProfileIdsByWhereWithAnyFilters.mockResolvedValue(["profile-b"])
  })

  it("match all com várias email_contact_list usa INTERSECT SQL, sem Prisma OR-de-IN", async () => {
    const rules: RadarSegmentRules = {
      match: "all",
      conditions: [
        { kind: "email_contact_list", listIds: [LIST_A] },
        { kind: "email_contact_list", listIds: [LIST_B] },
      ],
    }

    const count = await radarSegmentQueryService.countProfiles(SCOPE, rules)
    const ids = await radarSegmentQueryService.listProfileIds(SCOPE, rules)

    expect(count).toBe(12)
    expect(ids).toEqual(["profile-a"])
    expect(countProfilesByEmailContactListIntersection).toHaveBeenCalledTimes(1)
    expect(countProfilesByEmailContactListIntersection).toHaveBeenCalledWith(TEAM_ID, [
      [LIST_A],
      [LIST_B],
    ])
    expect(listProfileIdsByEmailContactListIntersection).toHaveBeenCalledTimes(1)
    expect(countProfilesByEmailContactListIds).not.toHaveBeenCalled()
    expect(countProfilesByWhere).not.toHaveBeenCalled()
    expect(listProfileIdsByWhere).not.toHaveBeenCalled()
    expect(findProfileIdsByEmailContactListIds).not.toHaveBeenCalled()
    expect(countProfilesByWhereWithAnyFilters).not.toHaveBeenCalled()
  })

  it("email_contact_field com >32k contactIds usa ANY SQL, não countProfilesByWhere com chunks de 5000", async () => {
    const hugeContactIds = makeHugeContactIds()
    findEmailContactIdsByCustomField.mockResolvedValue(hugeContactIds)

    const rules: RadarSegmentRules = {
      match: "all",
      conditions: [
        {
          kind: "email_contact_field",
          fieldKey: "cargo",
          operator: "eq",
          value: "corretor",
        },
      ],
    }

    const count = await radarSegmentQueryService.countProfiles(SCOPE, rules)

    expect(count).toBe(7)
    expect(findEmailContactIdsByCustomField).toHaveBeenCalledTimes(1)
    expect(countProfilesByWhereWithAnyFilters).toHaveBeenCalledTimes(1)
    expect(countProfilesByWhereWithAnyFilters).toHaveBeenCalledWith(TEAM_ID, null, {
      combine: "intersect",
      listIdGroups: [],
      emailContactIdGroups: [hugeContactIds],
    })
    expect(countProfilesByWhere).not.toHaveBeenCalled()
    expect(findProfileIdsByEmailContactListIds).not.toHaveBeenCalled()
  })

  it("regra mista (lista + outra condição) usa caminho SQL ANY, sem OR-de-IN de 5000", async () => {
    const rules: RadarSegmentRules = {
      match: "all",
      conditions: [
        { kind: "email_contact_list", listIds: [LIST_A] },
        { kind: "engagement_band", bands: ["hot"] },
      ],
    }

    await radarSegmentQueryService.countProfiles(SCOPE, rules)

    expect(countProfilesByWhereWithAnyFilters).toHaveBeenCalledTimes(1)
    expect(countProfilesByWhereWithAnyFilters).toHaveBeenCalledWith(
      TEAM_ID,
      expect.objectContaining({ teamId: TEAM_ID }),
      {
        combine: "intersect",
        listIdGroups: [[LIST_A]],
        emailContactIdGroups: [],
      }
    )
    const anyFilterCalls = countProfilesByWhereWithAnyFilters.mock.calls as unknown as Array<
      [string, Prisma.RadarProfileWhereInput | null, AnyFilterOptions]
    >
    expect(whereHasOrOfInChunks(anyFilterCalls[0]?.[1])).toBe(false)
    expect(countProfilesByWhere).not.toHaveBeenCalled()
    expect(findProfileIdsByEmailContactListIds).not.toHaveBeenCalled()
    expect(countProfilesByEmailContactListIntersection).not.toHaveBeenCalled()
  })

  it("segmento só com uma email_contact_list continua no atalho SQL (trySoleEmailContactListIds)", async () => {
    countProfilesByEmailContactListIds.mockResolvedValue(42)

    const count = await radarSegmentQueryService.countProfiles(SCOPE, {
      match: "any",
      conditions: [{ kind: "email_contact_list", listIds: [LIST_A, LIST_B] }],
    } satisfies RadarSegmentRules)

    expect(count).toBe(42)
    expect(countProfilesByEmailContactListIds).toHaveBeenCalledWith(TEAM_ID, [LIST_A, LIST_B])
    expect(countProfilesByEmailContactListIntersection).not.toHaveBeenCalled()
    expect(countProfilesByWhere).not.toHaveBeenCalled()
    expect(countProfilesByWhereWithAnyFilters).not.toHaveBeenCalled()
  })

  it("countProfilesByWhere nunca recebe OR de IN em chunks de 5000 neste caminho", async () => {
    findEmailContactIdsByCustomField.mockResolvedValue(makeHugeContactIds())

    await radarSegmentQueryService.countProfiles(SCOPE, {
      match: "all",
      conditions: [
        { kind: "email_contact_list", listIds: [LIST_A] },
        { kind: "email_contact_list", listIds: [LIST_B] },
      ],
    } satisfies RadarSegmentRules)
    await radarSegmentQueryService.countProfiles(SCOPE, {
      match: "all",
      conditions: [
        { kind: "email_contact_field", fieldKey: "origem", operator: "not_empty" },
      ],
    } satisfies RadarSegmentRules)

    expect(countProfilesByWhere).not.toHaveBeenCalled()
  })
})

describe("RadarRepository SQL P2035 (nomes físicos)", () => {
  const repoSource = readFileSync(
    path.join(import.meta.dir, "../../infra/data/repositories/radar/RadarRepository.ts"),
    "utf8"
  )

  const start = repoSource.indexOf("private emailContactIdMatchedProfilesSql")
  const end = repoSource.indexOf("async findEmailContactIdsByCustomField", start)
  const fnSource = repoSource.slice(start, end)

  it("INTERSECT e ANY usam @@map físicos, não nomes de model Prisma", () => {
    expect(start).toBeGreaterThan(-1)
    expect(fnSource).toContain("INTERSECT")
    expect(fnSource).toContain("ANY(${contactIds}::text[])")
    expect(fnSource).toContain("ANY(${otherIds}::uuid[])")
    expect(fnSource).toContain('"corretor_studio_radar_identities"')
    expect(fnSource).toContain('"corretor_studio_radar_profiles"')
    expect(fnSource).not.toContain('"RadarIdentity"')
    expect(fnSource).not.toContain('"RadarProfile"')
    expect(fnSource).not.toContain('"EmailContact"')
  })

  it("emailContactListMatchedProfilesSql permanece com nomes físicos", () => {
    const listStart = repoSource.indexOf("private emailContactListMatchedProfilesSql")
    const listEnd = repoSource.indexOf("async findProfileIdsByEmailContactListIds", listStart)
    const listSource = repoSource.slice(listStart, listEnd)
    expect(listSource).toContain('"corretor_studio_radar_identities"')
    expect(listSource).toContain('"corretor_studio_email_contacts"')
    expect(listSource).toContain('"corretor_studio_radar_source_links"')
  })
})
