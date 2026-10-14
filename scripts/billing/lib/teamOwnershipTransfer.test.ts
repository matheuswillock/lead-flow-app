import { describe, expect, it } from "bun:test"
import {
  BRUNO_PROFILE_ID,
  TEAM_OWNERSHIP_TRANSFER_TARGETS,
  buildTeamOwnershipTransferPlan,
  type TeamOwnershipTransferInput,
} from "./teamOwnershipTransfer"

function makeInput(overrides: Partial<TeamOwnershipTransferInput> = {}): TeamOwnershipTransferInput {
  const teams = TEAM_OWNERSHIP_TRANSFER_TARGETS.map((target, index) => ({
    id: target.teamId,
    name: target.teamName,
    masterId: BRUNO_PROFILE_ID,
    isDefault: index === 19,
    deletedAt: null,
  }))
  const profiles = TEAM_OWNERSHIP_TRANSFER_TARGETS
    .filter((target, index, all) => all.findIndex((candidate) => candidate.profileId === target.profileId) === index)
    .map((target) => ({
      id: target.profileId,
      email: target.email,
      fullName: target.fullName,
      managerId: BRUNO_PROFILE_ID,
      isMaster: false,
      deletedAt: null,
    }))
  const memberships = TEAM_OWNERSHIP_TRANSFER_TARGETS.map((target) => ({
    teamId: target.teamId,
    profileId: target.profileId,
    role: "manager" as const,
  }))

  return { teams, profiles, memberships, ...overrides }
}

describe("buildTeamOwnershipTransferPlan", () => {
  it("planeja os 29 times, exclui CPR e mantém Ricardo como owner de dois times", () => {
    const plan = buildTeamOwnershipTransferPlan(makeInput())

    expect(TEAM_OWNERSHIP_TRANSFER_TARGETS).toHaveLength(29)
    expect(plan.blocked).toEqual([])
    expect(plan.transfers).toHaveLength(29)
    expect(plan.transfers.filter((item) => item.targetMasterId === "1ed74e00-4a16-47cb-84fc-8021943b5fa3")).toHaveLength(2)
    expect(TEAM_OWNERSHIP_TRANSFER_TARGETS.some((target) => target.teamName === "CPR")).toBe(false)
  })

  it("define o primeiro time do alvo como padrão quando ele recebe mais de um", () => {
    const plan = buildTeamOwnershipTransferPlan(makeInput())
    const ricardoTransfers = plan.transfers.filter((item) => item.targetMasterId === "1ed74e00-4a16-47cb-84fc-8021943b5fa3")

    expect(ricardoTransfers.map((item) => ({ team: item.teamName, isDefault: item.shouldBeDefault }))).toEqual([
      { team: "RR Benefício", isDefault: true },
      { team: "Renata De Nadai", isDefault: false },
    ])
  })

  it("rejeita owner atual, e-mail ou membership divergentes", () => {
    const input = makeInput({
      teams: makeInput().teams.map((team, index) => index === 0 ? { ...team, masterId: "another-owner" } : team),
      profiles: makeInput().profiles.map((profile) => profile.email === "edilson.gpj@gmail.com" ? { ...profile, email: "wrong@example.com" } : profile),
      memberships: makeInput().memberships.filter((membership) => membership.teamId !== TEAM_OWNERSHIP_TRANSFER_TARGETS[1]!.teamId),
    })
    const plan = buildTeamOwnershipTransferPlan(input)

    expect(plan.transfers).toHaveLength(26)
    expect(plan.blocked).toEqual(expect.arrayContaining([
      expect.objectContaining({ teamName: "RCACC Seguros", reason: "source_owner_mismatch" }),
      expect.objectContaining({ teamName: "Consultiva Integrale", reason: "target_membership_missing" }),
      expect.objectContaining({ teamName: "Aurum Seguros", reason: "target_email_mismatch" }),
    ]))
  })

  it("é idempotente quando o ownership já está aplicado", () => {
    const input = makeInput({
      teams: makeInput().teams.map((team) => {
        const target = TEAM_OWNERSHIP_TRANSFER_TARGETS.find((candidate) => candidate.teamId === team.id)!
        return { ...team, masterId: target.profileId, isDefault: false }
      }),
      profiles: makeInput().profiles.map((profile) => ({ ...profile, managerId: null, isMaster: true })),
    })
    const plan = buildTeamOwnershipTransferPlan(input)

    expect(plan.blocked).toEqual([])
    expect(plan.transfers.every((item) => item.action === "already_transferred")).toBe(true)
    expect(plan.profileUpdates).toHaveLength(28)
  })
})
