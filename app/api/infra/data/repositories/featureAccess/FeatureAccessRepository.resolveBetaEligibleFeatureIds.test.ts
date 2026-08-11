import { beforeEach, describe, expect, it, mock } from "bun:test"

type GrantTeam = { teamId: string }

type BetaGrantRow = {
  featureId: string
  betaTeamScope: "ALL_TEAMS" | "SPECIFIC_TEAMS"
  teams: GrantTeam[]
}

const FEATURE_ID = "feature-beta-1"
const MASTER_ID = "master-profile-1"
const MEMBER_ID = "member-profile-1"
const AUTHORIZED_TEAM_ID = "team-authorized"
const OTHER_TEAM_ID = "team-other"

let grantsForOwner: BetaGrantRow[] = []

const findManyMock = mock(
  async ({
    where,
  }: {
    where: { profileId: string; grantType: string; isActive: boolean }
  }) => {
    if (where.profileId === MASTER_ID && where.grantType === "BETA" && where.isActive) {
      return grantsForOwner
    }
    return []
  }
)

const prismaMock = {
  backofficeFeatureGrant: {
    findMany: findManyMock,
  },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
}))

const { FeatureAccessRepository } = await import("./FeatureAccessRepository")

describe("FeatureAccessRepository.resolveBetaEligibleFeatureIds", () => {
  let repository: InstanceType<typeof FeatureAccessRepository>

  beforeEach(() => {
    repository = new FeatureAccessRepository()
    findManyMock.mockClear()
    grantsForOwner = []
  })

  it("T01 — master com SPECIFIC_TEAMS e activeTeamId autorizado recebe feature beta", async () => {
    grantsForOwner = [
      {
        featureId: FEATURE_ID,
        betaTeamScope: "SPECIFIC_TEAMS",
        teams: [{ teamId: AUTHORIZED_TEAM_ID }],
      },
    ]

    const eligible = await repository.resolveBetaEligibleFeatureIds({
      profileId: MASTER_ID,
      activeTeamId: AUTHORIZED_TEAM_ID,
      managerId: null,
      isMaster: true,
    })

    expect(eligible.has(FEATURE_ID)).toBe(true)
  })

  it("T02 — master com SPECIFIC_TEAMS e activeTeamId não autorizado não recebe feature beta", async () => {
    grantsForOwner = [
      {
        featureId: FEATURE_ID,
        betaTeamScope: "SPECIFIC_TEAMS",
        teams: [{ teamId: AUTHORIZED_TEAM_ID }],
      },
    ]

    const eligible = await repository.resolveBetaEligibleFeatureIds({
      profileId: MASTER_ID,
      activeTeamId: OTHER_TEAM_ID,
      managerId: null,
      isMaster: true,
    })

    expect(eligible.has(FEATURE_ID)).toBe(false)
  })

  it("T03 — master com SPECIFIC_TEAMS sem activeTeamId não recebe feature beta", async () => {
    grantsForOwner = [
      {
        featureId: FEATURE_ID,
        betaTeamScope: "SPECIFIC_TEAMS",
        teams: [{ teamId: AUTHORIZED_TEAM_ID }],
      },
    ]

    const eligible = await repository.resolveBetaEligibleFeatureIds({
      profileId: MASTER_ID,
      activeTeamId: null,
      managerId: null,
      isMaster: true,
    })

    expect(eligible.has(FEATURE_ID)).toBe(false)
  })

  it("T04 — membro em time autorizado do master recebe feature beta", async () => {
    grantsForOwner = [
      {
        featureId: FEATURE_ID,
        betaTeamScope: "SPECIFIC_TEAMS",
        teams: [{ teamId: AUTHORIZED_TEAM_ID }],
      },
    ]

    const eligible = await repository.resolveBetaEligibleFeatureIds({
      profileId: MEMBER_ID,
      activeTeamId: AUTHORIZED_TEAM_ID,
      managerId: MASTER_ID,
      isMaster: false,
    })

    expect(eligible.has(FEATURE_ID)).toBe(true)
  })

  it("T05 — membro em time fora do escopo não recebe feature beta", async () => {
    grantsForOwner = [
      {
        featureId: FEATURE_ID,
        betaTeamScope: "SPECIFIC_TEAMS",
        teams: [{ teamId: AUTHORIZED_TEAM_ID }],
      },
    ]

    const eligible = await repository.resolveBetaEligibleFeatureIds({
      profileId: MEMBER_ID,
      activeTeamId: OTHER_TEAM_ID,
      managerId: MASTER_ID,
      isMaster: false,
    })

    expect(eligible.has(FEATURE_ID)).toBe(false)
  })

  it("T06 — grant ALL_TEAMS libera master e membros em qualquer time", async () => {
    grantsForOwner = [
      {
        featureId: FEATURE_ID,
        betaTeamScope: "ALL_TEAMS",
        teams: [],
      },
    ]

    const masterEligible = await repository.resolveBetaEligibleFeatureIds({
      profileId: MASTER_ID,
      activeTeamId: OTHER_TEAM_ID,
      managerId: null,
      isMaster: true,
    })
    const memberEligible = await repository.resolveBetaEligibleFeatureIds({
      profileId: MEMBER_ID,
      activeTeamId: OTHER_TEAM_ID,
      managerId: MASTER_ID,
      isMaster: false,
    })

    expect(masterEligible.has(FEATURE_ID)).toBe(true)
    expect(memberEligible.has(FEATURE_ID)).toBe(true)
  })
})
