import { describe, expect, it } from "bun:test"
import {
  buildTeamScopeVisibility,
  isTeamScopeVisibilityEmpty,
  listTeamScopeTeamIds,
} from "./teamScopeVisibility"

const OWNER_PROFILE_ID = "11111111-1111-4111-8111-111111111111"

describe("buildTeamScopeVisibility", () => {
  it("particiona o papel POR TIME: manager no A enxerga o time inteiro, operator no B só os próprios", () => {
    const visibility = buildTeamScopeVisibility({
      ownerProfileId: OWNER_PROFILE_ID,
      memberships: [
        { teamId: "team-a", role: "manager" },
        { teamId: "team-b", role: "operator" },
      ],
    })

    expect(visibility.fullVisibilityTeamIds).toEqual(["team-a"])
    expect(visibility.ownOnlyTeamIds).toEqual(["team-b"])
    expect(visibility.ownerProfileId).toBe(OWNER_PROFILE_ID)
  })

  it("não aplica UMA restrição global: o papel do primeiro time não vaza para os demais", () => {
    const visibility = buildTeamScopeVisibility({
      ownerProfileId: OWNER_PROFILE_ID,
      memberships: [
        { teamId: "team-operator", role: "operator" },
        { teamId: "team-manager", role: "manager" },
        { teamId: "team-backoffice", role: "backoffice" },
      ],
    })

    expect(visibility.fullVisibilityTeamIds).toEqual(["team-manager", "team-backoffice"])
    expect(visibility.ownOnlyTeamIds).toEqual(["team-operator"])
  })

  it("mantém todos os times das memberships, inclusive de masters diferentes", () => {
    const visibility = buildTeamScopeVisibility({
      ownerProfileId: OWNER_PROFILE_ID,
      memberships: [
        { teamId: "team-master-1", role: "manager" },
        { teamId: "team-master-2", role: "manager" },
        { teamId: "team-master-3", role: "operator" },
      ],
    })

    expect(listTeamScopeTeamIds(visibility).sort()).toEqual([
      "team-master-1",
      "team-master-2",
      "team-master-3",
    ])
  })

  it("devolve escopo vazio quando o perfil não tem membership", () => {
    const visibility = buildTeamScopeVisibility({
      ownerProfileId: OWNER_PROFILE_ID,
      memberships: [],
    })

    expect(isTeamScopeVisibilityEmpty(visibility)).toBe(true)
  })

  it("não considera vazio um escopo que só tem times restritos aos próprios agendamentos", () => {
    const visibility = buildTeamScopeVisibility({
      ownerProfileId: OWNER_PROFILE_ID,
      memberships: [{ teamId: "team-b", role: "operator" }],
    })

    expect(isTeamScopeVisibilityEmpty(visibility)).toBe(false)
  })
})
