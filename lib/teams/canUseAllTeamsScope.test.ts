import { describe, expect, it } from "bun:test"
import { computeCanUseAllTeamsScope } from "./canUseAllTeamsScope"

describe("computeCanUseAllTeamsScope", () => {
  it("habilita escopo quando delegado tem canViewAllTeams e a conta tem mais de um time", () => {
    const result = computeCanUseAllTeamsScope({
      isTeamMaster: false,
      activeTeam: {
        role: "backoffice",
        canViewAllTeams: true,
        masterId: "master-1",
        accountTeamsCount: 7,
      },
      memberTeamsInAccount: 1,
    })

    expect(result).toBe(true)
  })

  it("não habilita escopo quando delegado não tem canViewAllTeams", () => {
    const result = computeCanUseAllTeamsScope({
      isTeamMaster: false,
      activeTeam: {
        role: "backoffice",
        canViewAllTeams: false,
        masterId: "master-1",
        accountTeamsCount: 7,
      },
      memberTeamsInAccount: 1,
    })

    expect(result).toBe(false)
  })

  it("não habilita escopo quando a conta tem apenas um time", () => {
    const result = computeCanUseAllTeamsScope({
      isTeamMaster: true,
      activeTeam: {
        role: "manager",
        canViewAllTeams: true,
        masterId: "master-1",
        accountTeamsCount: 1,
      },
      memberTeamsInAccount: 1,
    })

    expect(result).toBe(false)
  })
})
