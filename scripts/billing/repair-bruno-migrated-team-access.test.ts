import { describe, expect, it } from "bun:test"
import { buildRepairActions, REPAIR_EXPIRY } from "./repair-bruno-migrated-team-access"

const base = {
  teamId: "team-1",
  teamName: "Team 1",
  ownerId: "owner-1",
  ownerEmail: "owner@example.com",
  crmSubscriptionId: null,
  activeGrace: { id: "grace-1", expiresAt: null as Date | null },
  brunoMembership: {
    id: "membership-1",
    role: "manager",
    functions: ["CLOSER"],
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
  },
}

describe("buildRepairActions", () => {
  it("plans membership capability repair and indefinite grace normalization", () => {
    const actions = buildRepairActions([
      { ...base, teamId: "27edf455-e61a-48a9-a846-e2c6f42999b5", ownerId: "owner-rcacc" },
    ])

    expect(actions).toEqual([
      { kind: "expire_grace", teamId: "27edf455-e61a-48a9-a846-e2c6f42999b5", graceId: "grace-1" },
      { kind: "update_membership", teamId: "27edf455-e61a-48a9-a846-e2c6f42999b5", membershipId: "membership-1" },
    ])
    expect(REPAIR_EXPIRY).toBe("2026-11-19T03:00:00.000Z")
  })

  it("plans CRM, grace, and membership creation for the missing Renata path", () => {
    const actions = buildRepairActions([
      {
        ...base,
        teamId: "eefbf327-b160-438c-a6ca-d5e0179c4a38",
        ownerId: "1ed74e00-4a16-47cb-84fc-8021943b5fa3",
        activeGrace: { id: "grace-2", expiresAt: new Date("2026-11-19T03:00:00.000Z") },
        brunoMembership: null,
      },
    ])

    expect(actions).toEqual([
      { kind: "create_membership", teamId: "eefbf327-b160-438c-a6ca-d5e0179c4a38" },
    ])
  })
})
